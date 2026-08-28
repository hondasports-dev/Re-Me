import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation, internalQuery } from './_generated/server'
import {
  nextNotificationAvailableAt,
  sanitizeNotificationErrorCode,
} from './lib/notificationPolicy'
import { NOTIFICATION_CLAIM_LIMIT, NOTIFICATION_LOCK_TIMEOUT_MS } from './lib/validators'

const claimedJobValidator = v.object({
  generationToken: v.string(),
  jobId: v.id('notificationJobs'),
})

function boundedLimit(limit: number | undefined, max: number) {
  return Math.min(Math.max(limit ?? max, 1), max)
}

export const claimNotificationJobs = internalMutation({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(claimedJobValidator),
  handler: async (ctx, args) => {
    const limit = boundedLimit(args.limit, NOTIFICATION_CLAIM_LIMIT)
    const claimed: Array<{ generationToken: string; jobId: Id<'notificationJobs'> }> = []
    const seen = new Set<string>()

    const pending = await ctx.db
      .query('notificationJobs')
      .withIndex('by_status_and_availableAt', (q) =>
        q.eq('status', 'pending').lte('availableAt', args.now),
      )
      .take(limit)
    const failed = await ctx.db
      .query('notificationJobs')
      .withIndex('by_status_and_availableAt', (q) =>
        q.eq('status', 'failed').lte('availableAt', args.now),
      )
      .take(limit)
    const processing = await ctx.db
      .query('notificationJobs')
      .withIndex('by_status_and_availableAt', (q) =>
        q.eq('status', 'processing').lte('availableAt', args.now),
      )
      .take(limit)

    for (const job of [...pending, ...failed, ...processing]) {
      if (claimed.length >= limit || seen.has(job._id)) {
        continue
      }

      const next = await claimJob(ctx, job, args.now)
      if (!next) {
        continue
      }

      seen.add(job._id)
      claimed.push(next)
    }

    return claimed
  },
})

export const completeNotificationJob = internalMutation({
  args: {
    jobId: v.id('notificationJobs'),
    generationToken: v.string(),
    outcome: v.union(
      v.object({ kind: v.literal('sent') }),
      v.object({
        kind: v.literal('failed'),
        errorCode: v.string(),
      }),
    ),
  },
  returns: v.object({
    accepted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)

    if (!job || job.status !== 'processing' || job.generationToken !== args.generationToken) {
      return { accepted: false }
    }

    const now = Date.now()

    if (args.outcome.kind === 'sent') {
      await ctx.db.patch(job._id, {
        status: 'sent',
        sentAt: now,
        lockedAt: undefined,
        lastErrorCode: undefined,
        updatedAt: now,
      })
      return { accepted: true }
    }

    const attemptCount = job.attemptCount + 1
    await ctx.db.patch(job._id, {
      status: 'failed',
      attemptCount,
      availableAt: nextNotificationAvailableAt(now, attemptCount),
      lockedAt: undefined,
      lastErrorCode: sanitizeNotificationErrorCode(args.outcome.errorCode),
      updatedAt: now,
    })
    return { accepted: true }
  },
})

export const getNotificationSendTarget = internalQuery({
  args: {
    jobId: v.id('notificationJobs'),
    generationToken: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      ownerId: v.id('users'),
      subscriptions: v.array(
        v.object({
          auth: v.string(),
          endpoint: v.string(),
          p256dh: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId)

    if (!job || job.status !== 'processing' || job.generationToken !== args.generationToken) {
      return null
    }

    const subscriptions = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_ownerId', (q) => q.eq('ownerId', job.ownerId))
      .take(20)

    return {
      ownerId: job.ownerId,
      subscriptions: subscriptions
        .filter((subscription) => subscription.disabledAt === undefined)
        .map((subscription) => ({
          auth: subscription.auth,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
        })),
    }
  },
})

async function claimJob(
  ctx: MutationCtx,
  job: Doc<'notificationJobs'>,
  now: number,
): Promise<{ generationToken: string; jobId: Id<'notificationJobs'> } | null> {
  const current = await ctx.db.get(job._id)

  if (!current || current.status === 'sent' || current.availableAt > now) {
    return null
  }

  const generationToken = crypto.randomUUID()
  await ctx.db.patch(current._id, {
    status: 'processing',
    generationToken,
    lockedAt: now,
    availableAt: now + NOTIFICATION_LOCK_TIMEOUT_MS,
    updatedAt: now,
  })

  return { generationToken, jobId: current._id }
}
