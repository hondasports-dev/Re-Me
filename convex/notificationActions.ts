'use node'

import { v } from 'convex/values'
import webpush from 'web-push'

import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import {
  arrivalNotificationPayload,
  isPermanentlyInvalidPushEndpoint,
} from './lib/notificationPolicy'

export const sendNotificationJob = internalAction({
  args: {
    jobId: v.id('notificationJobs'),
    generationToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.notifications.getNotificationSendTarget, args)

    if (!target) {
      return null
    }

    if (target.subscriptions.length === 0) {
      await ctx.runMutation(internal.notifications.completeNotificationJob, {
        jobId: args.jobId,
        generationToken: args.generationToken,
        outcome: { kind: 'sent' },
      })
      return null
    }

    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
    const subject = process.env.WEB_PUSH_SUBJECT

    if (!publicKey || !privateKey || !subject) {
      await ctx.runMutation(internal.notifications.completeNotificationJob, {
        jobId: args.jobId,
        generationToken: args.generationToken,
        outcome: { kind: 'failed', errorCode: 'push_config_missing' },
      })
      return null
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)
    const payload = arrivalNotificationPayload()
    let delivered = 0

    for (const subscription of target.subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh,
            },
          },
          payload,
        )
        delivered += 1
      } catch (error) {
        if (isPermanentlyInvalidPushEndpoint(error)) {
          await ctx.runMutation(internal.notifications.disablePushSubscription, {
            ownerId: target.ownerId,
            endpoint: subscription.endpoint,
          })
        }
        console.error(
          JSON.stringify({
            event: 'notification_push_failed',
            endpointHost: hostOf(subscription.endpoint),
            reason: error instanceof Error ? error.name : 'push_failed',
          }),
        )
      }
    }

    await ctx.runMutation(internal.notifications.completeNotificationJob, {
      jobId: args.jobId,
      generationToken: args.generationToken,
      outcome: delivered > 0 ? { kind: 'sent' } : { kind: 'failed', errorCode: 'push_failed' },
    })
    return null
  },
})

function hostOf(endpoint: string) {
  try {
    return new URL(endpoint).host
  } catch {
    return 'invalid'
  }
}
