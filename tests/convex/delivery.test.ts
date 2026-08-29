import { describe, expect, it } from 'vitest'

import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { DUE_DELIVERY_LIMIT } from '../../convex/lib/validators'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }

describe('deliverDueLetters', () => {
  it('does not expose delivery or notification internals on the public API', () => {
    expect('delivery' in api).toBe(false)
    expect('notifications' in api).toBe(false)
    expect('notificationActions' in api).toBe(false)
  })

  it('delivers a due traveling letter once and creates a single outbox job', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const { letterId, scheduledAt } = await seedTravelingLetter(t, user.userId, { due: true })

    const first = await t.mutation(internal.delivery.deliverDueLetters, {
      now: scheduledAt + 1,
      limit: 10,
    })
    const second = await t.mutation(internal.delivery.deliverDueLetters, {
      now: scheduledAt + 1,
      limit: 10,
    })

    expect(first).toEqual({ canceledCount: 0, deliveredCount: 1, skippedCount: 0 })
    expect(second).toEqual({ canceledCount: 0, deliveredCount: 0, skippedCount: 0 })

    const letter = await readLetter(t, letterId)
    const delivery = await readDelivery(t, letterId)
    const jobs = await readJobs(t, letterId)
    const serialized = JSON.stringify({
      first,
      second,
      letter,
      delivery: { status: delivery?.status },
    })

    expect(letter?.status).toBe('delivered')
    expect(letter?.deliveredAt).toEqual(expect.any(Number))
    expect(delivery?.status).toBe('consumed')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.status).toBe('pending')
    expect(serialized).not.toContain('scheduledAt')
    expect(serialized).not.toContain(String(scheduledAt))
  })

  it('does not deliver future or deleted letters', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const future = await seedTravelingLetter(t, user.userId, { due: false })

    const futureResult = await t.mutation(internal.delivery.deliverDueLetters, {
      now: future.scheduledAt - 1,
      limit: 10,
    })

    expect(futureResult.deliveredCount).toBe(0)
    expect((await readLetter(t, future.letterId))?.status).toBe('traveling')
    expect((await readDelivery(t, future.letterId))?.status).toBe('pending')

    const deleted = await seedTravelingLetter(t, user.userId, { due: true, deleted: true })
    const canceled = await t.mutation(internal.delivery.deliverDueLetters, {
      now: deleted.scheduledAt + 1,
      limit: 10,
    })

    expect(canceled.canceledCount).toBe(1)
    expect((await readLetter(t, deleted.letterId))?.status).toBe('traveling')
    expect((await readLetter(t, deleted.letterId))?.deletedAt).toEqual(expect.any(Number))
    expect((await readDelivery(t, deleted.letterId))?.status).toBe('canceled')
    expect(await readJobs(t, deleted.letterId)).toHaveLength(0)
  })

  it('leaves overflow due letters for the next bounded sweep', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const now = Date.now()

    for (let index = 0; index < DUE_DELIVERY_LIMIT + 1; index += 1) {
      await seedTravelingLetter(t, user.userId, { due: true, scheduledAt: now - 1_000 - index })
    }

    const first = await t.mutation(internal.delivery.deliverDueLetters, {
      now,
      limit: DUE_DELIVERY_LIMIT,
    })
    const second = await t.mutation(internal.delivery.deliverDueLetters, {
      now,
      limit: DUE_DELIVERY_LIMIT,
    })

    expect(first.deliveredCount).toBe(DUE_DELIVERY_LIMIT)
    expect(second.deliveredCount).toBe(1)
  })

  it('cancels deleted due rows in the take window so a live letter can be delivered next', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const now = Date.now()

    await seedTravelingLetter(t, user.userId, {
      due: true,
      deleted: true,
      scheduledAt: now - 3_000,
    })
    await seedTravelingLetter(t, user.userId, {
      due: true,
      deleted: true,
      scheduledAt: now - 2_000,
    })
    const live = await seedTravelingLetter(t, user.userId, { due: true, scheduledAt: now - 1_000 })

    const first = await t.mutation(internal.delivery.deliverDueLetters, { now, limit: 2 })
    const second = await t.mutation(internal.delivery.deliverDueLetters, { now, limit: 2 })

    expect(first).toEqual({ canceledCount: 2, deliveredCount: 0, skippedCount: 0 })
    expect(second.deliveredCount).toBe(1)
    expect((await readLetter(t, live.letterId))?.status).toBe('delivered')
  })

  it('keeps the letter delivered when push completion fails or a stale generation returns', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const { letterId, scheduledAt } = await seedTravelingLetter(t, user.userId, { due: true })

    await t.mutation(internal.delivery.deliverDueLetters, { now: scheduledAt + 1, limit: 10 })
    const claimed = await t.mutation(internal.notifications.claimNotificationJobs, {
      now: scheduledAt + 1,
      limit: 10,
    })
    const job = claimed[0]
    expect(job).toBeDefined()

    const failed = await t.mutation(internal.notifications.completeNotificationJob, {
      jobId: job!.jobId,
      generationToken: job!.generationToken,
      now: scheduledAt + 1,
      outcome: { kind: 'failed', errorCode: 'push_failed' },
    })
    expect(failed.accepted).toBe(true)
    expect((await readLetter(t, letterId))?.status).toBe('delivered')
    expect((await readJobs(t, letterId))[0]?.status).toBe('failed')

    const reclaimed = await t.mutation(internal.notifications.claimNotificationJobs, {
      now: scheduledAt + 1 + 3 * 60_000,
      limit: 10,
    })
    const stale = await t.mutation(internal.notifications.completeNotificationJob, {
      jobId: job!.jobId,
      generationToken: job!.generationToken,
      outcome: { kind: 'sent' },
    })

    expect(reclaimed).toHaveLength(1)
    expect(stale.accepted).toBe(false)
    expect((await readJobs(t, letterId))[0]?.status).toBe('processing')
    expect((await readJobs(t, letterId))[0]?.generationToken).toBe(reclaimed[0]?.generationToken)
    expect((await readLetter(t, letterId))?.status).toBe('delivered')
  })

  it('marks a job sent when the owner has no push subscription', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const { letterId, scheduledAt } = await seedTravelingLetter(t, user.userId, { due: true })

    await t.mutation(internal.delivery.deliverDueLetters, { now: scheduledAt + 1, limit: 10 })
    const claimed = await t.mutation(internal.notifications.claimNotificationJobs, {
      now: scheduledAt + 1,
      limit: 10,
    })
    const job = claimed[0]
    expect(job).toBeDefined()

    await t.action(internal.notificationActions.sendNotificationJob, {
      jobId: job!.jobId,
      generationToken: job!.generationToken,
    })

    expect((await readJobs(t, letterId))[0]?.status).toBe('sent')
    expect((await readLetter(t, letterId))?.status).toBe('delivered')
  })

  it('fails the outbox without reverting delivery when VAPID config is missing', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const { letterId, scheduledAt } = await seedTravelingLetter(t, user.userId, { due: true })

    await t.run(async (ctx) => {
      await ctx.db.insert('pushSubscriptions', {
        ownerId: user.userId,
        endpoint: 'https://push.example.test/alice',
        p256dh: 'p256dh-public',
        auth: 'auth-secret',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    await t.mutation(internal.delivery.deliverDueLetters, { now: scheduledAt + 1, limit: 10 })
    const claimed = await t.mutation(internal.notifications.claimNotificationJobs, {
      now: scheduledAt + 1,
      limit: 10,
    })
    const job = claimed[0]
    expect(job).toBeDefined()

    await t.action(internal.notificationActions.sendNotificationJob, {
      jobId: job!.jobId,
      generationToken: job!.generationToken,
    })

    expect((await readLetter(t, letterId))?.status).toBe('delivered')
    expect((await readJobs(t, letterId))[0]?.status).toBe('failed')
    expect((await readJobs(t, letterId))[0]?.lastErrorCode).toBe('push_config_missing')
  })

  it('does not treat disabled subscriptions as an empty push target', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const { letterId, scheduledAt } = await seedTravelingLetter(t, user.userId, { due: true })
    const now = Date.now()

    await t.run(async (ctx) => {
      for (let index = 0; index < 20; index += 1) {
        await ctx.db.insert('pushSubscriptions', {
          ownerId: user.userId,
          endpoint: `https://push.example.test/disabled-${index}`,
          p256dh: 'p256dh-public',
          auth: 'auth-secret',
          createdAt: now,
          updatedAt: now,
          disabledAt: now,
        })
      }
      await ctx.db.insert('pushSubscriptions', {
        ownerId: user.userId,
        endpoint: 'https://push.example.test/live',
        p256dh: 'p256dh-public',
        auth: 'auth-secret',
        createdAt: now,
        updatedAt: now,
      })
    })

    await t.mutation(internal.delivery.deliverDueLetters, { now: scheduledAt + 1, limit: 10 })
    const claimed = await t.mutation(internal.notifications.claimNotificationJobs, {
      now: scheduledAt + 1,
      limit: 10,
    })
    const job = claimed[0]
    expect(job).toBeDefined()

    await t.action(internal.notificationActions.sendNotificationJob, {
      jobId: job!.jobId,
      generationToken: job!.generationToken,
    })

    expect((await readLetter(t, letterId))?.status).toBe('delivered')
    expect((await readJobs(t, letterId))[0]?.status).toBe('failed')
    expect((await readJobs(t, letterId))[0]?.lastErrorCode).toBe('push_config_missing')
  })

  it('delivers each owner independently and keeps one job per letter', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const aliceUser = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const bobUser = await asBob.mutation(api.users.ensureCurrentUser, {})
    const aliceLetter = await seedTravelingLetter(t, aliceUser.userId, { due: true })
    const bobLetter = await seedTravelingLetter(t, bobUser.userId, { due: true })

    await t.mutation(internal.delivery.deliverDueLetters, {
      now: Math.max(aliceLetter.scheduledAt, bobLetter.scheduledAt) + 1,
      limit: 10,
    })

    expect((await readLetter(t, aliceLetter.letterId))?.status).toBe('delivered')
    expect((await readLetter(t, bobLetter.letterId))?.status).toBe('delivered')
    expect(await readJobs(t, aliceLetter.letterId)).toHaveLength(1)
    expect(await readJobs(t, bobLetter.letterId)).toHaveLength(1)
    expect((await readJobs(t, aliceLetter.letterId))[0]?.ownerId).toBe(aliceUser.userId)
    expect((await readJobs(t, bobLetter.letterId))[0]?.ownerId).toBe(bobUser.userId)
  })

  it('disables a gone push subscription for that owner only', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const aliceUser = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const bobUser = await asBob.mutation(api.users.ensureCurrentUser, {})
    const now = 1_700_000_000_000
    const endpoint = 'https://push.example.test/gone'

    await t.run(async (ctx) => {
      await ctx.db.insert('pushSubscriptions', {
        ownerId: aliceUser.userId,
        endpoint,
        p256dh: 'p256dh-public',
        auth: 'auth-secret',
        createdAt: now,
        updatedAt: now,
      })
    })

    const otherOwner = await t.mutation(internal.notifications.disablePushSubscription, {
      ownerId: bobUser.userId,
      endpoint,
      now: now + 1,
    })
    const disabled = await t.mutation(internal.notifications.disablePushSubscription, {
      ownerId: aliceUser.userId,
      endpoint,
      now: now + 2,
    })
    const again = await t.mutation(internal.notifications.disablePushSubscription, {
      ownerId: aliceUser.userId,
      endpoint,
      now: now + 3,
    })

    expect(otherOwner).toEqual({ disabled: false })
    expect(disabled).toEqual({ disabled: true })
    expect(again).toEqual({ disabled: true })

    const stored = await t.run(async (ctx) => {
      return await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_endpoint', (q) => q.eq('endpoint', endpoint))
        .first()
    })
    expect(stored?.disabledAt).toBe(now + 2)
  })

  it('claims the oldest pending notification job first', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const older = await seedTravelingLetter(t, user.userId, { due: true, scheduledAt: 1_000 })
    const newer = await seedTravelingLetter(t, user.userId, { due: true, scheduledAt: 2_000 })

    await t.mutation(internal.delivery.deliverDueLetters, { now: 3_000, limit: 10 })

    await t.run(async (ctx) => {
      const jobs = await ctx.db.query('notificationJobs').collect()
      for (const job of jobs) {
        const availableAt = job.letterId === older.letterId ? 10 : 20
        await ctx.db.patch(job._id, { availableAt })
      }
    })

    const claimed = await t.mutation(internal.notifications.claimNotificationJobs, {
      now: 1_000_000,
      limit: 1,
    })
    const firstClaim = claimed[0]
    expect(firstClaim).toBeDefined()
    const claimedJob = firstClaim
      ? await t.run(async (ctx) => await ctx.db.get(firstClaim.jobId))
      : null

    expect(claimed).toHaveLength(1)
    expect(claimedJob?.letterId).toBe(older.letterId)
    expect(claimedJob?.letterId).not.toBe(newer.letterId)
  })

  it('claims a newer pending job before an older failed job', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const failedLetter = await seedTravelingLetter(t, user.userId, {
      due: true,
      scheduledAt: 1_000,
    })
    const pendingLetter = await seedTravelingLetter(t, user.userId, {
      due: true,
      scheduledAt: 2_000,
    })

    await t.mutation(internal.delivery.deliverDueLetters, { now: 3_000, limit: 10 })

    await t.run(async (ctx) => {
      const jobs = await ctx.db.query('notificationJobs').collect()
      for (const job of jobs) {
        if (job.letterId === failedLetter.letterId) {
          await ctx.db.patch(job._id, { availableAt: 1, status: 'failed' })
        } else if (job.letterId === pendingLetter.letterId) {
          await ctx.db.patch(job._id, { availableAt: 100, status: 'pending' })
        }
      }
    })

    const claimed = await t.mutation(internal.notifications.claimNotificationJobs, {
      now: 1_000_000,
      limit: 1,
    })
    const firstClaim = claimed[0]
    const claimedJob = firstClaim
      ? await t.run(async (ctx) => await ctx.db.get(firstClaim.jobId))
      : null

    expect(claimed).toHaveLength(1)
    expect(claimedJob?.letterId).toBe(pendingLetter.letterId)
    expect(claimedJob?.letterId).not.toBe(failedLetter.letterId)
  })
})

async function seedTravelingLetter(
  t: ReturnType<typeof testConvex>,
  ownerId: Id<'users'>,
  options: { deleted?: boolean; due: boolean; scheduledAt?: number },
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const scheduledAt = options.scheduledAt ?? (options.due ? now - 1_000 : now + 86_400_000)
    const threadId = await ctx.db.insert('threads', {
      ownerId,
      createdAt: now,
      updatedAt: now,
    })
    const letterId = await ctx.db.insert('letters', {
      threadId,
      ownerId,
      status: 'traveling',
      sealed: true,
      deliveryMode: 'few_days',
      deliveryWindowStart: now + 3 * 86_400_000,
      deliveryWindowEnd: now + 7 * 86_400_000,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: options.deleted ? now : undefined,
    })
    await ctx.db.insert('letterContents', {
      letterId,
      ownerId,
      body: '届いてほしくない本文',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('letterDeliveries', {
      letterId,
      ownerId,
      scheduledAt,
      status: 'pending',
      attemptCount: 0,
      createdAt: now,
    })

    return { letterId, scheduledAt, threadId }
  })
}

async function readLetter(t: ReturnType<typeof testConvex>, letterId: Id<'letters'>) {
  return await t.run(async (ctx) => await ctx.db.get(letterId))
}

async function readDelivery(t: ReturnType<typeof testConvex>, letterId: Id<'letters'>) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query('letterDeliveries')
      .withIndex('by_letterId', (q) => q.eq('letterId', letterId))
      .unique()
  })
}

async function readJobs(t: ReturnType<typeof testConvex>, letterId: Id<'letters'>) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query('notificationJobs')
      .withIndex('by_letterId', (q) => q.eq('letterId', letterId))
      .collect()
  })
}
