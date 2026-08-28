import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export type DeliverySweepResult = {
  canceledCount: number
  deliveredCount: number
  skippedCount: number
}

export async function deliverDueLetterDocuments(
  ctx: MutationCtx,
  deliveries: Array<Doc<'letterDeliveries'>>,
  now: number,
): Promise<DeliverySweepResult> {
  const result: DeliverySweepResult = {
    canceledCount: 0,
    deliveredCount: 0,
    skippedCount: 0,
  }

  for (const delivery of deliveries) {
    const outcome = await deliverOrCancelPendingDelivery(ctx, delivery, now)
    if (outcome === 'canceled') {
      result.canceledCount += 1
    } else if (outcome === 'delivered') {
      result.deliveredCount += 1
    } else {
      result.skippedCount += 1
    }
  }

  return result
}

async function deliverOrCancelPendingDelivery(
  ctx: MutationCtx,
  delivery: Doc<'letterDeliveries'>,
  now: number,
): Promise<'canceled' | 'delivered' | 'skipped'> {
  const currentDelivery = await ctx.db.get(delivery._id)

  if (!currentDelivery || currentDelivery.status !== 'pending') {
    return 'skipped'
  }

  const letter = await ctx.db.get(currentDelivery.letterId)

  if (!letter || letter.deletedAt !== undefined) {
    await ctx.db.patch(currentDelivery._id, {
      status: 'canceled',
      lastAttemptAt: now,
      attemptCount: currentDelivery.attemptCount + 1,
    })
    return 'canceled'
  }

  if (letter.status === 'delivered') {
    await consumeDeliveryAndEnsureJob(ctx, letter, currentDelivery, now)
    return 'delivered'
  }

  if (letter.status !== 'traveling') {
    await ctx.db.patch(currentDelivery._id, {
      status: 'canceled',
      lastAttemptAt: now,
      attemptCount: currentDelivery.attemptCount + 1,
    })
    return 'canceled'
  }

  await ctx.db.patch(letter._id, {
    status: 'delivered',
    deliveredAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(letter.threadId, { updatedAt: now })
  await consumeDeliveryAndEnsureJob(ctx, letter, currentDelivery, now)
  return 'delivered'
}

async function consumeDeliveryAndEnsureJob(
  ctx: MutationCtx,
  letter: Doc<'letters'>,
  delivery: Doc<'letterDeliveries'>,
  now: number,
) {
  await ctx.db.patch(delivery._id, {
    status: 'consumed',
    lastAttemptAt: now,
    attemptCount: delivery.attemptCount + 1,
  })
  await ensureNotificationJob(ctx, letter._id, letter.ownerId, now)
}

async function ensureNotificationJob(
  ctx: MutationCtx,
  letterId: Id<'letters'>,
  ownerId: Id<'users'>,
  now: number,
) {
  const existing = await ctx.db
    .query('notificationJobs')
    .withIndex('by_letterId', (q) => q.eq('letterId', letterId))
    .unique()

  if (existing) {
    return
  }

  await ctx.db.insert('notificationJobs', {
    letterId,
    ownerId,
    status: 'pending',
    attemptCount: 0,
    generationToken: crypto.randomUUID(),
    availableAt: now,
    createdAt: now,
    updatedAt: now,
  })
}
