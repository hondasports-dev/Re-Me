import { v } from 'convex/values'

import { internalQuery } from './_generated/server'
import { DUE_DELIVERY_LIMIT } from './lib/validators'

export const listDueDeliveries = internalQuery({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      deliveryId: v.id('letterDeliveries'),
      letterId: v.id('letters'),
      scheduledAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? DUE_DELIVERY_LIMIT, 1), DUE_DELIVERY_LIMIT)
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
        scheduledAt: delivery.scheduledAt,
      })
    }

    return due
  },
})
