import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { getCurrentUser } from './lib/auth'
import { upsertOwnedPushSubscription } from './lib/pushSubscriptions'
import { pushDisableResultValidator, pushStatusValidator } from './lib/validators'

export const getMyPushStatus = query({
  args: {
    endpoint: v.optional(v.string()),
  },
  returns: pushStatusValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)

    if (args.endpoint !== undefined) {
      const endpoint = args.endpoint
      const subscription = await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_endpoint', (q) => q.eq('endpoint', endpoint))
        .first()

      return {
        enabled:
          subscription !== null &&
          subscription.ownerId === user._id &&
          subscription.disabledAt === undefined,
      }
    }

    const active = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_ownerId_and_disabledAt', (q) =>
        q.eq('ownerId', user._id).eq('disabledAt', undefined),
      )
      .take(1)

    return { enabled: active.length > 0 }
  },
})

export const upsertMine = mutation({
  args: {
    auth: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    userAgent: v.optional(v.string()),
  },
  returns: pushStatusValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    return await upsertOwnedPushSubscription(ctx, user._id, args)
  },
})

export const disableMine = mutation({
  args: {
    endpoint: v.string(),
  },
  returns: pushDisableResultValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const subscription = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .first()

    if (!subscription || subscription.ownerId !== user._id) {
      return { enabled: false as const, owned: false }
    }

    const now = Date.now()

    if (subscription.disabledAt === undefined) {
      await ctx.db.patch(subscription._id, {
        disabledAt: now,
        updatedAt: now,
      })
    }

    return { enabled: false as const, owned: true }
  },
})
