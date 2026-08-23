'use node'

import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { R2 } from '@convex-dev/r2'
import { v } from 'convex/values'

import { components, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action } from './_generated/server'
import {
  inspectSanitizedPhoto,
  MAX_SANITIZED_PHOTO_BYTES,
  SANITIZED_PHOTO_MIME_TYPE,
  UPLOAD_CAPABILITY_SECONDS,
} from './lib/photoPolicy'

const r2 = new R2(components.r2)

export const finalizeAttachment = action({
  args: {
    attachmentId: v.id('letterAttachments'),
    generationToken: v.string(),
  },
  returns: v.object({ attachmentId: v.id('letterAttachments') }),
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.attachments.getPendingPhotoForFinalize, args)

    if (!target) {
      throw new Error('photo upload intent is unavailable')
    }

    const claim = await ctx.runMutation(internal.attachments.claimPhotoFinalizationAttempt, {
      ...args,
      runnerToken: crypto.randomUUID(),
    })
    if (!claim.acquired) {
      return { attachmentId: args.attachmentId }
    }
    const finalizationAttempt: {
      attemptId: Id<'attachmentFinalizationAttempts'>
      objectKey: string
    } = { attemptId: claim.attemptId, objectKey: claim.objectKey }
    let copiedFinalObjectKey: string | undefined
    let finalizationStage = 'head'
    try {
      const metadata = await r2.client.send(
        new HeadObjectCommand({ Bucket: r2.config.bucket, Key: target.uploadObjectKey }),
      )
      if (
        metadata.ContentType !== SANITIZED_PHOTO_MIME_TYPE ||
        metadata.ContentLength !== target.byteSize ||
        metadata.ContentLength > MAX_SANITIZED_PHOTO_BYTES ||
        !metadata.ETag
      ) {
        throw new Error('uploaded photo metadata does not match the intent')
      }

      finalizationStage = 'read'
      const object = await r2.client.send(
        new GetObjectCommand({
          Bucket: r2.config.bucket,
          Key: target.uploadObjectKey,
          IfMatch: metadata.ETag,
        }),
      )

      if (!object.Body) {
        throw new Error('uploaded photo is missing')
      }

      finalizationStage = 'inspect'
      const bytes = await object.Body.transformToByteArray()
      const inspected = inspectSanitizedPhoto(bytes)

      if (
        object.ContentType !== SANITIZED_PHOTO_MIME_TYPE ||
        inspected.byteSize !== target.byteSize ||
        inspected.width !== target.width ||
        inspected.height !== target.height
      ) {
        throw new Error('uploaded photo metadata does not match the intent')
      }

      finalizationStage = 'copy'
      copiedFinalObjectKey = finalizationAttempt.objectKey
      await r2.client.send(
        new CopyObjectCommand({
          Bucket: r2.config.bucket,
          Key: copiedFinalObjectKey,
          CopySource: `${r2.config.bucket}/${target.uploadObjectKey}`,
          CopySourceIfMatch: metadata.ETag,
          ContentType: SANITIZED_PHOTO_MIME_TYPE,
          MetadataDirective: 'REPLACE',
        }),
      )
      finalizationStage = 'commit'
      const commitResult = await ctx.runMutation(internal.attachments.completePhotoUpload, {
        ...args,
        attemptId: finalizationAttempt.attemptId,
        finalObjectKey: copiedFinalObjectKey,
        sourceEtag: metadata.ETag,
        inspected,
      })

      if (commitResult === 'lost') {
        try {
          await ctx.scheduler.runAfter(0, internal.attachments.deleteUnreferencedFinalObject, {
            attachmentId: args.attachmentId,
            attemptId: finalizationAttempt.attemptId,
            generationToken: args.generationToken,
            objectKey: copiedFinalObjectKey,
          })
        } catch {
          console.error('photo loser cleanup scheduling failed')
        }
        return { attachmentId: args.attachmentId }
      }

      try {
        await ctx.scheduler.runAfter(0, internal.attachments.syncFinalMetadata, {
          ...args,
          finalObjectKey: copiedFinalObjectKey,
        })
        await ctx.scheduler.runAfter(
          Math.max(target.uploadExpiresAt - Date.now() + UPLOAD_CAPABILITY_SECONDS * 1_000, 0),
          internal.attachments.deleteStagingObject,
          {
            ...args,
            uploadObjectKey: target.uploadObjectKey,
          },
        )
      } catch {
        console.error('photo post-commit scheduling failed')
      }
      return { attachmentId: args.attachmentId }
    } catch (error) {
      console.error('photo finalization failed', {
        errorMessage: error instanceof Error ? error.message : 'unknown error',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        stage: finalizationStage,
      })
      const shouldDeleteAttempt = await ctx.runMutation(
        internal.attachments.markFinalizationAttemptDeleting,
        {
          attachmentId: args.attachmentId,
          attemptId: finalizationAttempt.attemptId,
          generationToken: args.generationToken,
          objectKey: finalizationAttempt.objectKey,
        },
      )
      if (shouldDeleteAttempt) {
        await ctx.scheduler.runAfter(0, internal.attachments.deleteUnreferencedFinalObject, {
          attachmentId: args.attachmentId,
          attemptId: finalizationAttempt.attemptId,
          generationToken: args.generationToken,
          objectKey: finalizationAttempt.objectKey,
        })
      }
      const transitioned = await ctx.runMutation(internal.attachments.markPhotoDeleting, {
        ...args,
        errorCode: 'upload_validation_failed',
      })
      if (transitioned) {
        await ctx.scheduler.runAfter(0, internal.attachments.deleteAttachmentObject, {
          ...args,
          uploadObjectKey: target.uploadObjectKey,
          ...(copiedFinalObjectKey ? { finalObjectKey: copiedFinalObjectKey } : {}),
        })
      }
      throw new Error('photo upload could not be finalized')
    }
  },
})
