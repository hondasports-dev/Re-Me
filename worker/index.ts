import { importJWK, SignJWT, type JWK } from 'jose'

import { app } from './app'
import {
  completeNotificationJob,
  disablePushForOwner,
  getNotificationSendTarget,
  reconcileAttachments,
  sweepDeliveryAndNotification,
} from './domain'
import type { AppEnv } from './types'

interface NotificationMessage {
  jobId: string
  generationToken: string
}

const worker = {
  fetch(request: Request, env: AppEnv, context: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, context)
  },

  async scheduled(_controller: ScheduledController, env: AppEnv): Promise<void> {
    const delivery = await sweepDeliveryAndNotification(env)
    for (const job of delivery.claimed) {
      try {
        await env.NOTIFICATION_QUEUE.send(job)
      } catch (error) {
        await completeNotificationJob(env, job.jobId, job.generationToken, {
          kind: 'failed',
          errorCode: 'push_failed',
        })
        console.error(
          JSON.stringify({
            event: 'notification_queue_enqueue_failed',
            reason: error instanceof Error ? error.name : 'unknown_error',
          }),
        )
      }
    }
    await reconcileAttachments(env)
    console.log(
      JSON.stringify({
        event: 'delivery_sweep',
        canceledCount: delivery.canceledCount,
        claimedCount: delivery.claimed.length,
        deliveredCount: delivery.deliveredCount,
      }),
    )
  },

  async queue(batch: MessageBatch<NotificationMessage>, env: AppEnv): Promise<void> {
    for (const message of batch.messages) {
      const value = message.body
      if (!isNotificationMessage(value)) {
        message.ack()
        continue
      }
      try {
        await processNotificationJob(env, value)
        message.ack()
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'notification_job_failed',
            reason: error instanceof Error ? error.name : 'unknown_error',
          }),
        )
        message.ack()
      }
    }
  },
}

export default worker satisfies ExportedHandler<Env, NotificationMessage>

async function processNotificationJob(env: AppEnv, message: NotificationMessage): Promise<void> {
  const target = await getNotificationSendTarget(env, message.jobId, message.generationToken)
  if (!target) return
  if (target.subscriptions.length === 0) {
    await completeNotificationJob(env, message.jobId, message.generationToken, { kind: 'sent' })
    return
  }

  const publicKey = env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  const subject = env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject) {
    await completeNotificationJob(env, message.jobId, message.generationToken, {
      kind: 'failed',
      errorCode: 'push_config_missing',
    })
    return
  }

  let delivered = 0
  for (const subscription of target.subscriptions) {
    try {
      const response = await sendEmptyPush(subscription.endpoint, publicKey, privateKey, subject)
      if (response.status === 404 || response.status === 410) {
        await disablePushForOwner(env, target.ownerId, subscription.endpoint)
      } else if (response.ok) {
        delivered += 1
      } else {
        console.error(
          JSON.stringify({
            event: 'notification_push_failed',
            endpointHost: safeHost(subscription.endpoint),
            status: response.status,
          }),
        )
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'notification_push_failed',
          endpointHost: safeHost(subscription.endpoint),
          reason: error instanceof Error ? error.name : 'push_failed',
        }),
      )
    }
  }

  await completeNotificationJob(
    env,
    message.jobId,
    message.generationToken,
    delivered > 0 ? { kind: 'sent' } : { kind: 'failed', errorCode: 'push_failed' },
  )
}

async function sendEmptyPush(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string,
): Promise<Response> {
  const audience = new URL(endpoint).origin
  const key = await importJWK(toVapidJwk(publicKey, privateKey), 'ES256')
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(audience)
    .setSubject(subject)
    .setExpirationTime('12h')
    .sign(key)
  return await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${token}, k=${publicKey}`,
      TTL: '86400',
    },
  })
}

function toVapidJwk(publicKey: string, privateKey: string): JWK {
  const publicBytes = decodeBase64Url(publicKey)
  const privateBytes = decodeBase64Url(privateKey)
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04 || privateBytes.length !== 32) {
    throw new Error('vapid_config_invalid')
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: encodeBase64Url(publicBytes.slice(1, 33)),
    y: encodeBase64Url(publicBytes.slice(33, 65)),
    d: encodeBase64Url(privateBytes),
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function isNotificationMessage(value: unknown): value is NotificationMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NotificationMessage).jobId === 'string' &&
    typeof (value as NotificationMessage).generationToken === 'string'
  )
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'invalid'
  }
}
