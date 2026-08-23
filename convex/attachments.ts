import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { R2 } from '@convex-dev/r2'
import { v } from 'convex/values'

import { components, internal } from './_generated/api'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { getCurrentUser } from './lib/auth'
import { canReadLetterContent } from './lib/authorization'
import {
  clearDraftLocation as deleteDraftLocationAttachment,
  listLetterAttachments,
  loadOwnedDraft,
  loadVisibleLetter,
  upsertDraftLocation,
} from './lib/letters'
import {
  assertExpectedPhotoMetadata,
  DOWNLOAD_CAPABILITY_SECONDS,
  MAX_PHOTOS_PER_LETTER,
  SANITIZED_PHOTO_MIME_TYPE,
  UPLOAD_CAPABILITY_SECONDS,
} from './lib/photoPolicy'
import {
  attachmentDownloadCapabilityValidator,
  attachmentUploadIntentValidator,
  readableAttachmentValidator,
} from './lib/validators'

const r2 = new R2(components.r2)
const RECONCILIATION_LIMIT = 20
const DELETE_RETRY_BASE_MS = 60_000
const FINALIZATION_LEASE_MS = 5 * 60_000
const FINALIZATION_TOMBSTONE_MS = 12 * 60_000

export const listReadableAttachments = query({
  args: { letterId: v.id('letters') },
  returns: v.union(v.array(readableAttachmentValidator), v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadVisibleLetter(ctx, user._id, args.letterId)

    if (!letter || !canReadLetterContent(letter, user._id)) {
      return null
    }

    const attachments = await listLetterAttachments(ctx, letter._id)

    return attachments
      .filter((attachment) => attachment.status !== 'deleting')
      .map((attachment) => ({
        attachmentId: attachment._id,
        kind: attachment.kind,
        status: attachment.status,
        generationToken: attachment.generationToken ?? null,
        mimeType: attachment.mimeType ?? null,
        byteSize: attachment.byteSize ?? null,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
        locationLabel: attachment.locationLabel ?? null,
      }))
  },
})

export const createAttachmentIntent = mutation({
  args: {
    letterId: v.id('letters'),
    mimeType: v.string(),
    byteSize: v.number(),
    width: v.number(),
    height: v.number(),
  },
  returns: attachmentUploadIntentValidator,
  handler: async (ctx, args) => {
    assertExpectedPhotoMetadata(args)

    const user = await getCurrentUser(ctx)
    const letter = await loadOwnedDraft(ctx, user._id, args.letterId)
    const attachments = await listLetterAttachments(ctx, letter._id)
    const now = Date.now()
    let activePhotoCount = 0

    for (const attachment of attachments) {
      if (attachment.kind !== 'photo' || attachment.status === 'deleting') {
        continue
      }

      if (
        attachment.status === 'pending' &&
        attachment.uploadExpiresAt !== undefined &&
        attachment.uploadExpiresAt <= now &&
        attachment.uploadR2ObjectId &&
        attachment.generationToken
      ) {
        await ctx.db.patch(attachment._id, {
          status: 'deleting',
          nextReconcileAt: now,
          updatedAt: now,
        })
        await ctx.scheduler.runAfter(0, internal.attachments.deleteAttachmentObject, {
          attachmentId: attachment._id,
          generationToken: attachment.generationToken,
          uploadObjectKey: attachment.uploadR2ObjectId,
        })
        continue
      }

      activePhotoCount += 1
    }

    if (activePhotoCount >= MAX_PHOTOS_PER_LETTER) {
      throw new Error('a letter can have at most three photos')
    }

    const generationToken = crypto.randomUUID()
    const uploadObjectKey = `staging/${letter._id}/${generationToken}.jpg`
    const expiresAt = now + UPLOAD_CAPABILITY_SECONDS * 1_000
    const attachmentId = await ctx.db.insert('letterAttachments', {
      letterId: letter._id,
      ownerId: user._id,
      kind: 'photo',
      status: 'pending',
      uploadR2ObjectId: uploadObjectKey,
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      width: args.width,
      height: args.height,
      generationToken,
      uploadExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    const uploadUrl = await getSignedUrl(
      r2.client,
      new PutObjectCommand({
        Bucket: r2.config.bucket,
        Key: uploadObjectKey,
        ContentLength: args.byteSize,
        ContentType: SANITIZED_PHOTO_MIME_TYPE,
        IfNoneMatch: '*',
      }),
      { expiresIn: UPLOAD_CAPABILITY_SECONDS },
    )

    return { attachmentId, generationToken, uploadUrl, expiresAt }
  },
})

export const createAttachmentDownloadCapability = action({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
  },
  returns: v.union(attachmentDownloadCapabilityValidator, v.null()),
  handler: async (ctx, args): Promise<{ url: string; expiresAt: number } | null> => {
    const target: { objectKey: string } | null = await ctx.runQuery(
      internal.attachments.getReadablePhotoObject,
      args,
    )

    if (!target) {
      return null
    }

    return {
      url: await r2.getUrl(target.objectKey, { expiresIn: DOWNLOAD_CAPABILITY_SECONDS }),
      expiresAt: Date.now() + DOWNLOAD_CAPABILITY_SECONDS * 1_000,
    }
  },
})

export const removeDraftPhoto = mutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      !attachment ||
      attachment.ownerId !== user._id ||
      attachment.kind !== 'photo' ||
      attachment.generationToken !== args.generationToken ||
      (!attachment.r2ObjectId && !attachment.uploadR2ObjectId)
    ) {
      throw new Error('draft photo not found')
    }

    const letter = await loadOwnedDraft(ctx, user._id, attachment.letterId)
    const now = Date.now()
    await ctx.db.patch(attachment._id, {
      status: 'deleting',
      nextReconcileAt: now,
      lastErrorCode: undefined,
      updatedAt: now,
    })
    await ctx.db.patch(letter._id, { updatedAt: now })
    await ctx.db.patch(letter.threadId, { updatedAt: now })
    await ctx.scheduler.runAfter(0, internal.attachments.deleteAttachmentObject, {
      ...args,
      ...(attachment.uploadR2ObjectId ? { uploadObjectKey: attachment.uploadR2ObjectId } : {}),
      ...(attachment.r2ObjectId ? { finalObjectKey: attachment.r2ObjectId } : {}),
    })
    return null
  },
})

export const setDraftLocation = mutation({
  args: {
    letterId: v.id('letters'),
    locationLabel: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadOwnedDraft(ctx, user._id, args.letterId)
    return await upsertDraftLocation(ctx, letter, args.locationLabel)
  },
})

export const removeDraftLocation = mutation({
  args: { letterId: v.id('letters') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadOwnedDraft(ctx, user._id, args.letterId)
    await deleteDraftLocationAttachment(ctx, letter)
    return null
  },
})

export const getPendingPhotoForFinalize = internalQuery({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
  },
  returns: v.union(
    v.object({
      letterId: v.id('letters'),
      uploadObjectKey: v.string(),
      byteSize: v.number(),
      width: v.number(),
      height: v.number(),
      uploadExpiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      !attachment ||
      attachment.ownerId !== user._id ||
      attachment.kind !== 'photo' ||
      attachment.status !== 'pending' ||
      attachment.generationToken !== args.generationToken ||
      !attachment.uploadR2ObjectId ||
      attachment.byteSize === undefined ||
      attachment.width === undefined ||
      attachment.height === undefined ||
      attachment.uploadExpiresAt === undefined ||
      attachment.uploadExpiresAt < Date.now()
    ) {
      return null
    }

    const letter = await loadVisibleLetter(ctx, user._id, attachment.letterId)

    if (!letter || letter.status !== 'draft') {
      return null
    }

    return {
      letterId: attachment.letterId,
      uploadObjectKey: attachment.uploadR2ObjectId,
      byteSize: attachment.byteSize,
      width: attachment.width,
      height: attachment.height,
      uploadExpiresAt: attachment.uploadExpiresAt,
    }
  },
})

export const claimPhotoFinalizationAttempt = internalMutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    runnerToken: v.string(),
  },
  returns: v.object({
    acquired: v.boolean(),
    attemptId: v.id('attachmentFinalizationAttempts'),
    objectKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      !attachment ||
      attachment.ownerId !== user._id ||
      attachment.kind !== 'photo' ||
      attachment.status !== 'pending' ||
      attachment.generationToken !== args.generationToken
    ) {
      throw new Error('photo upload intent is stale')
    }

    await loadOwnedDraft(ctx, user._id, attachment.letterId)
    const now = Date.now()
    const existing = await ctx.db
      .query('attachmentFinalizationAttempts')
      .withIndex('by_attachmentId_and_state', (q) =>
        q.eq('attachmentId', attachment._id).eq('state', 'claimed'),
      )
      .first()
    if (existing && existing.nextReconcileAt !== undefined && existing.nextReconcileAt > now) {
      return { acquired: false, attemptId: existing._id, objectKey: existing.objectKey }
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        state: 'deleting',
        lastErrorCode: 'finalization_lease_expired',
        nextReconcileAt: now,
        retireAfter: now + FINALIZATION_TOMBSTONE_MS,
        updatedAt: now,
      })
    }
    const objectKey = `letters/${attachment.letterId}/${args.generationToken}/${crypto.randomUUID()}.jpg`
    const attemptId = await ctx.db.insert('attachmentFinalizationAttempts', {
      attachmentId: attachment._id,
      generationToken: args.generationToken,
      runnerToken: args.runnerToken,
      objectKey,
      state: 'claimed',
      deleteAttemptCount: 0,
      nextReconcileAt: now + FINALIZATION_LEASE_MS,
      createdAt: now,
      updatedAt: now,
    })
    return { acquired: true, attemptId, objectKey }
  },
})

export const getReadablePhotoObject = internalQuery({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
  },
  returns: v.union(v.object({ objectKey: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      !attachment ||
      attachment.ownerId !== user._id ||
      attachment.kind !== 'photo' ||
      attachment.status !== 'ready' ||
      attachment.generationToken !== args.generationToken ||
      !attachment.r2ObjectId
    ) {
      return null
    }

    const letter = await loadVisibleLetter(ctx, user._id, attachment.letterId)

    if (!letter || !canReadLetterContent(letter, user._id)) {
      return null
    }

    return { objectKey: attachment.r2ObjectId }
  },
})

export const completePhotoUpload = internalMutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    attemptId: v.id('attachmentFinalizationAttempts'),
    generationToken: v.string(),
    finalObjectKey: v.string(),
    sourceEtag: v.string(),
    inspected: v.object({
      mimeType: v.literal('image/jpeg'),
      byteSize: v.number(),
      width: v.number(),
      height: v.number(),
    }),
  },
  returns: v.union(v.literal('committed'), v.literal('already_committed'), v.literal('lost')),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const attachment = await ctx.db.get(args.attachmentId)
    const attempt = await ctx.db.get(args.attemptId)

    if (
      !attachment ||
      attachment.ownerId !== user._id ||
      attachment.kind !== 'photo' ||
      attachment.generationToken !== args.generationToken
    ) {
      throw new Error('photo upload intent is stale')
    }

    if (
      !attempt ||
      attempt.attachmentId !== attachment._id ||
      attempt.generationToken !== args.generationToken ||
      attempt.objectKey !== args.finalObjectKey
    ) {
      throw new Error('photo finalization attempt is stale')
    }

    if (attachment.status === 'ready') {
      if (
        attachment.r2ObjectId === args.finalObjectKey &&
        attachment.contentEtag === args.sourceEtag &&
        attachment.mimeType === args.inspected.mimeType &&
        attachment.byteSize === args.inspected.byteSize &&
        attachment.width === args.inspected.width &&
        attachment.height === args.inspected.height
      ) {
        if (attempt.state !== 'winner') {
          await ctx.db.patch(attempt._id, {
            state: 'winner',
            nextReconcileAt: undefined,
            lastErrorCode: undefined,
            updatedAt: Date.now(),
          })
        }
        return 'already_committed'
      }
      if (attempt.state !== 'winner') {
        const now = Date.now()
        await ctx.db.patch(attempt._id, {
          state: 'deleting',
          nextReconcileAt: now,
          retireAfter: now + FINALIZATION_TOMBSTONE_MS,
          lastErrorCode: 'finalization_lost',
          updatedAt: now,
        })
      }
      return 'lost'
    }

    if (attachment.status !== 'pending') {
      throw new Error('photo upload intent is stale')
    }
    if (attempt.state !== 'claimed') {
      return 'lost'
    }

    const letter = await loadOwnedDraft(ctx, user._id, attachment.letterId)
    const now = Date.now()
    await ctx.db.patch(attachment._id, {
      status: 'ready',
      r2ObjectId: args.finalObjectKey,
      contentEtag: args.sourceEtag,
      mimeType: args.inspected.mimeType,
      byteSize: args.inspected.byteSize,
      width: args.inspected.width,
      height: args.inspected.height,
      lastErrorCode: undefined,
      nextReconcileAt: undefined,
      updatedAt: now,
    })
    await ctx.db.patch(letter._id, { updatedAt: now })
    await ctx.db.patch(letter.threadId, { updatedAt: now })
    await ctx.db.patch(attempt._id, {
      state: 'winner',
      nextReconcileAt: undefined,
      lastErrorCode: undefined,
      updatedAt: now,
    })
    return 'committed'
  },
})

export const markPhotoDeleting = internalMutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    errorCode: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      attachment &&
      attachment.ownerId === user._id &&
      attachment.kind === 'photo' &&
      attachment.status === 'pending' &&
      attachment.generationToken === args.generationToken
    ) {
      const now = Date.now()
      await ctx.db.patch(attachment._id, {
        status: 'deleting',
        lastErrorCode: args.errorCode,
        nextReconcileAt: now,
        updatedAt: now,
      })
      return true
    }

    return false
  },
})

export const isCurrentFinalObject = internalQuery({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    objectKey: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId)
    return Boolean(
      attachment &&
      attachment.kind === 'photo' &&
      attachment.status === 'ready' &&
      attachment.generationToken === args.generationToken &&
      attachment.r2ObjectId === args.objectKey,
    )
  },
})

export const syncFinalMetadata = internalAction({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    finalObjectKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const isCurrent = await ctx.runQuery(internal.attachments.isCurrentFinalObject, {
      attachmentId: args.attachmentId,
      generationToken: args.generationToken,
      objectKey: args.finalObjectKey,
    })
    if (isCurrent) {
      await r2.syncMetadata(ctx, args.finalObjectKey)
    }
    return null
  },
})

const finalizationAttemptArgs = {
  attachmentId: v.id('letterAttachments'),
  attemptId: v.id('attachmentFinalizationAttempts'),
  generationToken: v.string(),
  objectKey: v.string(),
}

export const getFinalizationAttemptCleanupTarget = internalQuery({
  args: finalizationAttemptArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId)
    return Boolean(
      attempt &&
      attempt.attachmentId === args.attachmentId &&
      attempt.generationToken === args.generationToken &&
      attempt.objectKey === args.objectKey &&
      attempt.state === 'deleting',
    )
  },
})

export const markFinalizationAttemptDeleting = internalMutation({
  args: finalizationAttemptArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId)
    if (
      !attempt ||
      attempt.attachmentId !== args.attachmentId ||
      attempt.generationToken !== args.generationToken ||
      attempt.objectKey !== args.objectKey ||
      attempt.state === 'winner'
    ) {
      return false
    }
    const now = Date.now()
    await ctx.db.patch(attempt._id, {
      state: 'deleting',
      nextReconcileAt: now,
      retireAfter: now + FINALIZATION_TOMBSTONE_MS,
      updatedAt: now,
    })
    return true
  },
})

export const completeFinalizationAttemptDeletion = internalMutation({
  args: finalizationAttemptArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId)
    if (
      attempt &&
      attempt.attachmentId === args.attachmentId &&
      attempt.generationToken === args.generationToken &&
      attempt.objectKey === args.objectKey &&
      attempt.state === 'deleting'
    ) {
      const now = Date.now()
      const retireAfter = attempt.retireAfter ?? now + FINALIZATION_TOMBSTONE_MS
      if (now >= retireAfter) {
        await ctx.db.delete(attempt._id)
      } else {
        await ctx.db.patch(attempt._id, {
          deleteAttemptCount: 0,
          lastErrorCode: undefined,
          nextReconcileAt: retireAfter,
          retireAfter,
          updatedAt: now,
        })
      }
    }
    return null
  },
})

export const recordFinalizationAttemptDeletionFailure = internalMutation({
  args: finalizationAttemptArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId)
    if (
      attempt &&
      attempt.attachmentId === args.attachmentId &&
      attempt.generationToken === args.generationToken &&
      attempt.objectKey === args.objectKey &&
      attempt.state === 'deleting'
    ) {
      const attemptCount = attempt.deleteAttemptCount + 1
      const retryDelay = DELETE_RETRY_BASE_MS * Math.min(2 ** (attemptCount - 1), 60)
      const now = Date.now()
      await ctx.db.patch(attempt._id, {
        deleteAttemptCount: attemptCount,
        lastErrorCode: 'r2_delete_failed',
        nextReconcileAt: now + retryDelay,
        updatedAt: now,
      })
    }
    return null
  },
})

export const deleteUnreferencedFinalObject = internalAction({
  args: {
    attachmentId: v.id('letterAttachments'),
    attemptId: v.id('attachmentFinalizationAttempts'),
    generationToken: v.string(),
    objectKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shouldDelete = await ctx.runQuery(
      internal.attachments.getFinalizationAttemptCleanupTarget,
      args,
    )
    if (!shouldDelete) {
      return null
    }

    try {
      await r2.client.send(
        new DeleteObjectCommand({ Bucket: r2.config.bucket, Key: args.objectKey }),
      )
      await r2.deleteObject(ctx, args.objectKey)
      await ctx.runMutation(internal.attachments.completeFinalizationAttemptDeletion, args)
    } catch {
      await ctx.runMutation(internal.attachments.recordFinalizationAttemptDeletionFailure, args)
    }
    return null
  },
})

export const getDeletionTarget = internalQuery({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    uploadObjectKey: v.optional(v.string()),
    finalObjectKey: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId)
    return Boolean(
      attachment &&
      attachment.kind === 'photo' &&
      attachment.status === 'deleting' &&
      attachment.generationToken === args.generationToken &&
      attachment.uploadR2ObjectId === args.uploadObjectKey &&
      attachment.r2ObjectId === args.finalObjectKey,
    )
  },
})

export const deleteAttachmentObject = internalAction({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    uploadObjectKey: v.optional(v.string()),
    finalObjectKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const isCurrent = await ctx.runQuery(internal.attachments.getDeletionTarget, args)

    if (!isCurrent) {
      return null
    }

    try {
      const deletions: Array<Promise<unknown>> = []
      if (args.finalObjectKey) {
        deletions.push(
          r2.client.send(
            new DeleteObjectCommand({ Bucket: r2.config.bucket, Key: args.finalObjectKey }),
          ),
        )
      }
      if (args.uploadObjectKey) {
        deletions.push(
          r2.client.send(
            new DeleteObjectCommand({ Bucket: r2.config.bucket, Key: args.uploadObjectKey }),
          ),
        )
      }
      await Promise.all(deletions)
      if (args.finalObjectKey) {
        await r2.deleteObject(ctx, args.finalObjectKey)
      }
      await ctx.runMutation(internal.attachments.completePhotoDeletion, args)
    } catch {
      await ctx.runMutation(internal.attachments.recordPhotoDeletionFailure, args)
    }

    return null
  },
})

export const completePhotoDeletion = internalMutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    uploadObjectKey: v.optional(v.string()),
    finalObjectKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      attachment &&
      attachment.status === 'deleting' &&
      attachment.generationToken === args.generationToken &&
      attachment.uploadR2ObjectId === args.uploadObjectKey &&
      attachment.r2ObjectId === args.finalObjectKey
    ) {
      if (args.finalObjectKey) {
        const winner = await ctx.db
          .query('attachmentFinalizationAttempts')
          .withIndex('by_attachmentId_and_state', (q) =>
            q.eq('attachmentId', attachment._id).eq('state', 'winner'),
          )
          .unique()
        if (winner?.objectKey === args.finalObjectKey) {
          await ctx.db.delete(winner._id)
        }
      }
      await ctx.db.delete(attachment._id)
    }

    return null
  },
})

export const recordPhotoDeletionFailure = internalMutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    uploadObjectKey: v.optional(v.string()),
    finalObjectKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      attachment &&
      attachment.status === 'deleting' &&
      attachment.generationToken === args.generationToken &&
      attachment.uploadR2ObjectId === args.uploadObjectKey &&
      attachment.r2ObjectId === args.finalObjectKey
    ) {
      const attemptCount = (attachment.deleteAttemptCount ?? 0) + 1
      const retryDelay = DELETE_RETRY_BASE_MS * Math.min(2 ** (attemptCount - 1), 60)
      const now = Date.now()
      await ctx.db.patch(attachment._id, {
        deleteAttemptCount: attemptCount,
        lastErrorCode: 'r2_delete_failed',
        nextReconcileAt: now + retryDelay,
        updatedAt: now,
      })
    }

    return null
  },
})

export const deleteStagingObject = internalAction({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    uploadObjectKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await r2.client.send(
        new DeleteObjectCommand({ Bucket: r2.config.bucket, Key: args.uploadObjectKey }),
      )
      await ctx.runMutation(internal.attachments.completeStagingDeletion, args)
    } catch {
      // The ready attachment remains indexed by uploadExpiresAt for the next cron retry.
    }
    return null
  },
})

export const completeStagingDeletion = internalMutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
    uploadObjectKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId)
    if (
      attachment &&
      attachment.kind === 'photo' &&
      attachment.status === 'ready' &&
      attachment.generationToken === args.generationToken &&
      attachment.uploadR2ObjectId === args.uploadObjectKey
    ) {
      await ctx.db.patch(attachment._id, {
        uploadR2ObjectId: undefined,
        uploadExpiresAt: undefined,
        updatedAt: Date.now(),
      })
    }
    return null
  },
})

export const listAttachmentsForReconciliation = internalQuery({
  args: { now: v.number(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      attachmentId: v.id('letterAttachments'),
      generationToken: v.string(),
      uploadObjectKey: v.optional(v.string()),
      finalObjectKey: v.optional(v.string()),
      status: v.union(v.literal('pending'), v.literal('deleting'), v.literal('ready')),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? RECONCILIATION_LIMIT, 1), RECONCILIATION_LIMIT)
    const pending = await ctx.db
      .query('letterAttachments')
      .withIndex('by_status_and_uploadExpiresAt', (q) =>
        q.eq('status', 'pending').lte('uploadExpiresAt', args.now),
      )
      .take(limit)
    const deleting = await ctx.db
      .query('letterAttachments')
      .withIndex('by_status_and_nextReconcileAt', (q) =>
        q.eq('status', 'deleting').lte('nextReconcileAt', args.now),
      )
      .take(Math.max(limit - pending.length, 0))
    const ready = await ctx.db
      .query('letterAttachments')
      .withIndex('by_status_and_uploadExpiresAt', (q) =>
        q.eq('status', 'ready').lte('uploadExpiresAt', args.now),
      )
      .take(Math.max(limit - pending.length - deleting.length, 0))

    return [...pending, ...deleting, ...ready].flatMap((attachment) =>
      attachment.kind === 'photo' &&
      attachment.generationToken &&
      (attachment.uploadR2ObjectId || attachment.r2ObjectId)
        ? [
            {
              attachmentId: attachment._id,
              generationToken: attachment.generationToken,
              ...(attachment.uploadR2ObjectId
                ? { uploadObjectKey: attachment.uploadR2ObjectId }
                : {}),
              ...(attachment.r2ObjectId ? { finalObjectKey: attachment.r2ObjectId } : {}),
              status: attachment.status as 'pending' | 'deleting' | 'ready',
            },
          ]
        : [],
    )
  },
})

export const listFinalizationAttemptsForReconciliation = internalQuery({
  args: { now: v.number(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      attachmentId: v.id('letterAttachments'),
      attemptId: v.id('attachmentFinalizationAttempts'),
      generationToken: v.string(),
      objectKey: v.string(),
      state: v.union(v.literal('claimed'), v.literal('deleting')),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? RECONCILIATION_LIMIT, 1), RECONCILIATION_LIMIT)
    const claimed = await ctx.db
      .query('attachmentFinalizationAttempts')
      .withIndex('by_state_and_nextReconcileAt', (q) =>
        q.eq('state', 'claimed').lte('nextReconcileAt', args.now),
      )
      .take(limit)
    const deleting = await ctx.db
      .query('attachmentFinalizationAttempts')
      .withIndex('by_state_and_nextReconcileAt', (q) =>
        q.eq('state', 'deleting').lte('nextReconcileAt', args.now),
      )
      .take(Math.max(limit - claimed.length, 0))

    return [...claimed, ...deleting].map((attempt) => ({
      attachmentId: attempt.attachmentId,
      attemptId: attempt._id,
      generationToken: attempt.generationToken,
      objectKey: attempt.objectKey,
      state: attempt.state as 'claimed' | 'deleting',
    }))
  },
})

export const markExpiredPendingPhotoDeleting = internalMutation({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId)

    if (
      attachment &&
      attachment.status === 'pending' &&
      attachment.generationToken === args.generationToken &&
      attachment.uploadExpiresAt !== undefined &&
      attachment.uploadExpiresAt <= Date.now()
    ) {
      const now = Date.now()
      await ctx.db.patch(attachment._id, {
        status: 'deleting',
        lastErrorCode: 'upload_intent_expired',
        nextReconcileAt: now,
        updatedAt: now,
      })
    }

    return null
  },
})

export const reconcileAttachmentState = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const candidates = await ctx.runQuery(internal.attachments.listAttachmentsForReconciliation, {
      now: Date.now(),
      limit: RECONCILIATION_LIMIT,
    })

    for (const candidate of candidates) {
      if (candidate.status === 'ready' && candidate.uploadObjectKey) {
        await ctx.scheduler.runAfter(0, internal.attachments.deleteStagingObject, {
          attachmentId: candidate.attachmentId,
          generationToken: candidate.generationToken,
          uploadObjectKey: candidate.uploadObjectKey,
        })
        continue
      }

      if (candidate.status === 'pending') {
        await ctx.runMutation(internal.attachments.markExpiredPendingPhotoDeleting, {
          attachmentId: candidate.attachmentId,
          generationToken: candidate.generationToken,
        })
      }

      await ctx.scheduler.runAfter(0, internal.attachments.deleteAttachmentObject, {
        attachmentId: candidate.attachmentId,
        generationToken: candidate.generationToken,
        uploadObjectKey: candidate.uploadObjectKey,
        finalObjectKey: candidate.finalObjectKey,
      })
    }

    const attempts = await ctx.runQuery(
      internal.attachments.listFinalizationAttemptsForReconciliation,
      {
        now: Date.now(),
        limit: RECONCILIATION_LIMIT,
      },
    )
    for (const attempt of attempts) {
      if (attempt.state === 'claimed') {
        const transitioned = await ctx.runMutation(
          internal.attachments.markFinalizationAttemptDeleting,
          {
            attachmentId: attempt.attachmentId,
            attemptId: attempt.attemptId,
            generationToken: attempt.generationToken,
            objectKey: attempt.objectKey,
          },
        )
        if (!transitioned) {
          continue
        }
      }
      await ctx.scheduler.runAfter(0, internal.attachments.deleteUnreferencedFinalObject, {
        attachmentId: attempt.attachmentId,
        attemptId: attempt.attemptId,
        generationToken: attempt.generationToken,
        objectKey: attempt.objectKey,
      })
    }

    return null
  },
})
