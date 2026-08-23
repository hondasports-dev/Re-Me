import { describe, expect, it } from 'vitest'

import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }
const photo = { mimeType: 'image/jpeg', byteSize: 23, width: 1200, height: 800 } as const

describe('private R2 photo attachments', () => {
  it('requires authentication and draft ownership for upload intents', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const created = await asAlice.mutation(api.letters.createDraft, {})
    await asBob.mutation(api.users.ensureCurrentUser, {})

    await expect(
      t.mutation(api.attachments.createAttachmentIntent, { letterId: created.letterId, ...photo }),
    ).rejects.toThrow(/authentication required/)
    await expect(
      asBob.mutation(api.attachments.createAttachmentIntent, {
        letterId: created.letterId,
        ...photo,
      }),
    ).rejects.toThrow(/draft letter not found/)
  })

  it('creates a five-minute bucket-scoped upload capability and enforces three photos', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await asAlice.mutation(api.letters.createDraft, {})

    for (let count = 0; count < 3; count += 1) {
      const intent = await asAlice.mutation(api.attachments.createAttachmentIntent, {
        letterId: created.letterId,
        ...photo,
      })
      const url = new URL(intent.uploadUrl)
      expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length')
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('if-none-match')
      expect(decodeURIComponent(url.pathname)).toContain(`/staging/${created.letterId}/`)
      expect(intent.expiresAt).toBeGreaterThan(Date.now())

      const stored = await t.run(async (ctx) => await ctx.db.get(intent.attachmentId))
      expect(stored?.uploadR2ObjectId).toContain(`staging/${created.letterId}/`)
      expect(stored?.r2ObjectId).toBeUndefined()
    }

    await expect(
      asAlice.mutation(api.attachments.createAttachmentIntent, {
        letterId: created.letterId,
        ...photo,
      }),
    ).rejects.toThrow(/at most three photos/)
  })

  it('makes completion idempotent and never deletes an already-ready generation', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await asAlice.mutation(api.letters.createDraft, {})
    const intent = await asAlice.mutation(api.attachments.createAttachmentIntent, {
      letterId: created.letterId,
      ...photo,
    })
    const attemptA = await asAlice.mutation(internal.attachments.claimPhotoFinalizationAttempt, {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      runnerToken: 'runner-a',
    })
    const sameAttempt = await asAlice.mutation(internal.attachments.claimPhotoFinalizationAttempt, {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      runnerToken: 'runner-concurrent',
    })
    expect(attemptA.acquired).toBe(true)
    expect(sameAttempt).toMatchObject({
      acquired: false,
      attemptId: attemptA.attemptId,
      objectKey: attemptA.objectKey,
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(attemptA.attemptId, { nextReconcileAt: Date.now() - 1 })
    })
    const attemptB = await asAlice.mutation(internal.attachments.claimPhotoFinalizationAttempt, {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      runnerToken: 'runner-b',
    })
    expect(attemptB.acquired).toBe(true)
    const completeArgs = {
      attachmentId: intent.attachmentId,
      attemptId: attemptB.attemptId,
      generationToken: intent.generationToken,
      finalObjectKey: attemptB.objectKey,
      sourceEtag: '"etag-b"',
      inspected: photo,
    } as const

    await asAlice.mutation(internal.attachments.completePhotoUpload, completeArgs)
    await expect(
      asAlice.mutation(internal.attachments.completePhotoUpload, completeArgs),
    ).resolves.toBe('already_committed')
    await expect(
      asAlice.mutation(internal.attachments.completePhotoUpload, {
        ...completeArgs,
        attemptId: attemptA.attemptId,
        finalObjectKey: attemptA.objectKey,
        sourceEtag: '"etag-a"',
      }),
    ).resolves.toBe('lost')
    await expect(
      asAlice.mutation(internal.attachments.markPhotoDeleting, {
        attachmentId: intent.attachmentId,
        generationToken: intent.generationToken,
        errorCode: 'concurrent_finalize_failed',
      }),
    ).resolves.toBe(false)

    const stored = await t.run(async (ctx) => await ctx.db.get(intent.attachmentId))
    expect(stored?.status).toBe('ready')
    expect(stored?.r2ObjectId).toBe(completeArgs.finalObjectKey)
    expect(stored?.contentEtag).toBe(completeArgs.sourceEtag)
    const storedAttempts = await t.run(async (ctx) => ({
      winner: await ctx.db.get(attemptB.attemptId),
      loser: await ctx.db.get(attemptA.attemptId),
    }))
    expect(storedAttempts.winner?.state).toBe('winner')
    expect(storedAttempts.loser?.state).toBe('deleting')

    await t.run(async (ctx) => {
      await ctx.db.patch(intent.attachmentId, { uploadExpiresAt: Date.now() - 1 })
    })
    const cleanupDue = await t.query(internal.attachments.listAttachmentsForReconciliation, {
      now: Date.now(),
    })
    expect(cleanupDue).toEqual([
      expect.objectContaining({ attachmentId: intent.attachmentId, status: 'ready' }),
    ])
    await t.mutation(internal.attachments.completeStagingDeletion, {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      uploadObjectKey: stored!.uploadR2ObjectId!,
    })
    const cleaned = await t.run(async (ctx) => await ctx.db.get(intent.attachmentId))
    expect(cleaned?.uploadR2ObjectId).toBeUndefined()
    expect(cleaned?.uploadExpiresAt).toBeUndefined()
  })

  it('durably reconciles a finalization attempt abandoned after copy', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await asAlice.mutation(api.letters.createDraft, {})
    const intent = await asAlice.mutation(api.attachments.createAttachmentIntent, {
      letterId: created.letterId,
      ...photo,
    })
    const attempt = await asAlice.mutation(internal.attachments.claimPhotoFinalizationAttempt, {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      runnerToken: 'runner-abandoned',
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(attempt.attemptId, { nextReconcileAt: Date.now() - 1 })
    })

    const due = await t.query(internal.attachments.listFinalizationAttemptsForReconciliation, {
      now: Date.now(),
    })
    expect(due).toEqual([
      expect.objectContaining({
        attemptId: attempt.attemptId,
        objectKey: attempt.objectKey,
        state: 'claimed',
      }),
    ])

    await t.mutation(internal.attachments.markFinalizationAttemptDeleting, {
      attachmentId: intent.attachmentId,
      attemptId: attempt.attemptId,
      generationToken: intent.generationToken,
      objectKey: attempt.objectKey,
    })
    await t.mutation(internal.attachments.recordFinalizationAttemptDeletionFailure, {
      attachmentId: intent.attachmentId,
      attemptId: attempt.attemptId,
      generationToken: intent.generationToken,
      objectKey: attempt.objectKey,
    })

    const retained = await t.run(async (ctx) => await ctx.db.get(attempt.attemptId))
    expect(retained).toMatchObject({
      state: 'deleting',
      deleteAttemptCount: 1,
      lastErrorCode: 'r2_delete_failed',
    })
    expect(retained?.nextReconcileAt).toBeGreaterThan(Date.now())
  })

  it('retains a deletion tombstone until a late finalization writer can no longer finish', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await asAlice.mutation(api.letters.createDraft, {})
    const intent = await asAlice.mutation(api.attachments.createAttachmentIntent, {
      letterId: created.letterId,
      ...photo,
    })
    const attempt = await asAlice.mutation(internal.attachments.claimPhotoFinalizationAttempt, {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      runnerToken: 'runner-late',
    })
    const cleanupArgs = {
      attachmentId: intent.attachmentId,
      attemptId: attempt.attemptId,
      generationToken: intent.generationToken,
      objectKey: attempt.objectKey,
    }

    await t.mutation(internal.attachments.markFinalizationAttemptDeleting, cleanupArgs)
    await t.mutation(internal.attachments.completeFinalizationAttemptDeletion, cleanupArgs)

    const tombstone = await t.run(async (ctx) => await ctx.db.get(attempt.attemptId))
    expect(tombstone).toMatchObject({ state: 'deleting' })
    expect(tombstone?.retireAfter).toBeGreaterThan(Date.now())
    expect(tombstone?.nextReconcileAt).toBe(tombstone?.retireAfter)

    await t.run(async (ctx) => {
      await ctx.db.patch(attempt.attemptId, {
        nextReconcileAt: Date.now() - 1,
        retireAfter: Date.now() - 1,
      })
    })
    await t.mutation(internal.attachments.completeFinalizationAttemptDeletion, cleanupArgs)
    await expect(t.run(async (ctx) => await ctx.db.get(attempt.attemptId))).resolves.toBeNull()
  })

  it('rejects stale generations and reconciles expired pending intents', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await asAlice.mutation(api.letters.createDraft, {})
    const intent = await asAlice.mutation(api.attachments.createAttachmentIntent, {
      letterId: created.letterId,
      ...photo,
    })

    await expect(
      asAlice.action(api.attachmentActions.finalizeAttachment, {
        attachmentId: intent.attachmentId,
        generationToken: 'wrong-generation',
      }),
    ).rejects.toThrow(/unavailable/)

    await t.run(async (ctx) => {
      await ctx.db.patch(intent.attachmentId, { uploadExpiresAt: Date.now() - 1 })
    })
    await expect(
      asAlice.action(api.attachmentActions.finalizeAttachment, {
        attachmentId: intent.attachmentId,
        generationToken: intent.generationToken,
      }),
    ).rejects.toThrow(/unavailable/)
    const due = await t.query(internal.attachments.listAttachmentsForReconciliation, {
      now: Date.now(),
    })
    expect(due).toEqual([
      expect.objectContaining({ attachmentId: intent.attachmentId, status: 'pending' }),
    ])

    await t.action(internal.attachments.reconcileAttachmentState, {})
    const stored = await t.run(async (ctx) => await ctx.db.get(intent.attachmentId))
    expect(stored).toMatchObject({
      status: 'deleting',
      lastErrorCode: 'upload_intent_expired',
    })
  })

  it('records deletion failures with bounded exponential retry state', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await asAlice.mutation(api.letters.createDraft, {})
    const intent = await asAlice.mutation(api.attachments.createAttachmentIntent, {
      letterId: created.letterId,
      ...photo,
    })
    const stored = await t.run(async (ctx) => await ctx.db.get(intent.attachmentId))
    await t.run(async (ctx) => {
      await ctx.db.patch(intent.attachmentId, { status: 'deleting' })
    })
    const before = Date.now()
    await t.mutation(internal.attachments.recordPhotoDeletionFailure, {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      uploadObjectKey: stored!.uploadR2ObjectId,
      finalObjectKey: stored!.r2ObjectId!,
    })
    const failed = await t.run(async (ctx) => await ctx.db.get(intent.attachmentId))
    expect(failed).toMatchObject({ deleteAttemptCount: 1, lastErrorCode: 'r2_delete_failed' })
    expect(failed!.nextReconcileAt).toBeGreaterThanOrEqual(before + 60_000)
  })

  it('issues a 60-second read capability only to the owner when content is readable', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    await asBob.mutation(api.users.ensureCurrentUser, {})
    const readable = await seedReadyPhoto(t, user.userId, 'draft', false, false)

    const capability = await asAlice.action(api.attachments.createAttachmentDownloadCapability, {
      attachmentId: readable.attachmentId,
      generationToken: readable.generationToken,
    })
    expect(new URL(capability!.url).searchParams.get('X-Amz-Expires')).toBe('60')
    await expect(
      asBob.action(api.attachments.createAttachmentDownloadCapability, {
        attachmentId: readable.attachmentId,
        generationToken: readable.generationToken,
      }),
    ).resolves.toBeNull()
    await expect(
      asAlice.action(api.attachments.createAttachmentDownloadCapability, {
        attachmentId: readable.attachmentId,
        generationToken: 'stale-generation',
      }),
    ).resolves.toBeNull()

    const sealed = await seedReadyPhoto(t, user.userId, 'traveling', true, false)
    await expect(
      asAlice.action(api.attachments.createAttachmentDownloadCapability, {
        attachmentId: sealed.attachmentId,
        generationToken: sealed.generationToken,
      }),
    ).resolves.toBeNull()
  })

  it('does not allow photo removal after the letter is sent', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const sent = await seedReadyPhoto(t, user.userId, 'traveling', false, false)

    await expect(
      asAlice.mutation(api.attachments.removeDraftPhoto, {
        attachmentId: sent.attachmentId,
        generationToken: sent.generationToken,
      }),
    ).rejects.toThrow(/letter is not a draft/)
  })
})

async function seedReadyPhoto(
  t: ReturnType<typeof testConvex>,
  ownerId: Id<'users'>,
  status: 'draft' | 'traveling' | 'delivered',
  sealed: boolean,
  opened: boolean,
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const threadId = await ctx.db.insert('threads', { ownerId, createdAt: now, updatedAt: now })
    const letterId = await ctx.db.insert('letters', {
      threadId,
      ownerId,
      status,
      sealed,
      openedAt: opened ? now : undefined,
      createdAt: now,
      updatedAt: now,
    })
    const generationToken = crypto.randomUUID()
    const attachmentId = await ctx.db.insert('letterAttachments', {
      letterId,
      ownerId,
      kind: 'photo',
      status: 'ready',
      r2ObjectId: `letters/${letterId}/${generationToken}.jpg`,
      generationToken,
      mimeType: 'image/jpeg',
      byteSize: 23,
      width: 1200,
      height: 800,
      createdAt: now,
      updatedAt: now,
    })
    return { attachmentId, generationToken }
  })
}
