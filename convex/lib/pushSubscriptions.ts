import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

const MAX_ENDPOINT_LENGTH = 2048
const MAX_KEY_LENGTH = 256
const MAX_USER_AGENT_LENGTH = 256

export function assertPushSubscriptionInput(args: {
  auth: string
  endpoint: string
  p256dh: string
  userAgent?: string
}): void {
  if (args.endpoint.length === 0 || args.endpoint.length > MAX_ENDPOINT_LENGTH) {
    throw new Error('push subscription is invalid')
  }

  let parsed: URL

  try {
    parsed = new URL(args.endpoint)
  } catch {
    throw new Error('push subscription is invalid')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('push subscription is invalid')
  }

  if (args.p256dh.length === 0 || args.p256dh.length > MAX_KEY_LENGTH) {
    throw new Error('push subscription is invalid')
  }

  if (args.auth.length === 0 || args.auth.length > MAX_KEY_LENGTH) {
    throw new Error('push subscription is invalid')
  }

  if (args.userAgent !== undefined && args.userAgent.length > MAX_USER_AGENT_LENGTH) {
    throw new Error('push subscription is invalid')
  }
}

export async function upsertOwnedPushSubscription(
  ctx: MutationCtx,
  ownerId: Id<'users'>,
  args: {
    auth: string
    endpoint: string
    p256dh: string
    userAgent?: string
  },
): Promise<{ enabled: true }> {
  assertPushSubscriptionInput(args)

  const existing = await ctx.db
    .query('pushSubscriptions')
    .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
    .first()

  if (existing && existing.ownerId !== ownerId) {
    throw new Error('push subscription is not available')
  }

  const now = Date.now()

  if (existing) {
    await ctx.db.patch(existing._id, {
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent,
      disabledAt: undefined,
      updatedAt: now,
    })
    return { enabled: true }
  }

  await ctx.db.insert('pushSubscriptions', {
    ownerId,
    endpoint: args.endpoint,
    p256dh: args.p256dh,
    auth: args.auth,
    userAgent: args.userAgent,
    createdAt: now,
    updatedAt: now,
  })

  return { enabled: true }
}
