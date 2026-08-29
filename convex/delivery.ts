import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { deliverDueLetterDocuments } from './lib/deliverLetters'
import { DUE_DELIVERY_LIMIT } from './lib/validators'

const dueDeliveryValidator = v.object({
  deliveryId: v.id('letterDeliveries'),
  letterId: v.id('letters'),
})

function boundedLimit(limit: number | undefined, max: number) {
  return Math.min(Math.max(limit ?? max, 1), max)
}

export const listDueDeliveries = internalQuery({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(dueDeliveryValidator),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, DUE_DELIVERY_LIMIT)
    const deliveries = await ctx.db
      .query('letterDeliveries')
      .withIndex('by_status_and_scheduledAt', (q) =>
        q.eq('status', 'pending').lte('scheduledAt', args.now),
      )
      .take(limit)

    const due = []

    for (const delivery of deliveries) {
      const letter = await ctx.db.get(delivery.letterId)

      if (!letter || letter.deletedAt !== undefined || letter.status !== 'traveling') {
        continue
      }

      due.push({
        deliveryId: delivery._id,
        letterId: delivery.letterId,
      })
    }

    return due
  },
})

export const deliverDueLetters = internalMutation({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    canceledCount: v.number(),
    deliveredCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, DUE_DELIVERY_LIMIT)
    const deliveries = await ctx.db
      .query('letterDeliveries')
      .withIndex('by_status_and_scheduledAt', (q) =>
        q.eq('status', 'pending').lte('scheduledAt', args.now),
      )
      .take(limit)

    return await deliverDueLetterDocuments(ctx, deliveries, args.now)
  },
})

export const sweepDueDeliveries = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now()
    const delivery = await ctx.runMutation(internal.delivery.deliverDueLetters, { now })
    const claimed = await ctx.runMutation(internal.notifications.claimNotificationJobs, { now })

    for (const job of claimed) {
      await ctx.scheduler.runAfter(0, internal.notificationActions.sendNotificationJob, {
        jobId: job.jobId,
        generationToken: job.generationToken,
      })
    }

    console.log(
      JSON.stringify({
        event: 'delivery_sweep',
        canceledCount: delivery.canceledCount,
        claimedCount: claimed.length,
        deliveredCount: delivery.deliveredCount,
        skippedCount: delivery.skippedCount,
      }),
    )
    return null
  },
})
