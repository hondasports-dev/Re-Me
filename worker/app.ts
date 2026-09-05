import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { requireAuth } from './auth'
import { getThreadView } from './db'
import {
  createDraft,
  createDownloadCapability,
  createPhotoIntent,
  deleteTravelingLetter,
  disablePushSubscription,
  finalizePhoto,
  forceDeliverLetter,
  getCurrentUser,
  getDownloadTarget,
  getDraft,
  getMetadata,
  getPushStatus,
  getReadableContent,
  listLetters,
  listReadableAttachments,
  openLetter,
  publicUser,
  removeLocation,
  removePhoto,
  saveDraft,
  saveDraftSettings,
  sendLetter,
  upsertLocation,
  upsertPushSubscription,
  uploadPhoto,
  userByToken,
  type DraftInput,
  type PhotoIntentInput,
} from './domain'
import { HttpError, isHttpError } from './errors'
import type { AppEnv, AppVariables } from './types'

type WorkerAppEnv = { Bindings: AppEnv; Variables: AppVariables }

export const app = new Hono<WorkerAppEnv>()

app.use(
  '/api/*',
  cors({
    origin: (origin, context) => {
      const configured = (context.env as AppEnv).WEB_ORIGINS ?? ''
      const allowed = configured
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      return allowed.includes(origin) ? origin : undefined
    },
    allowHeaders: ['Authorization', 'Content-Type', 'If-None-Match', 'X-Re-Me-Test-User'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['ETag'],
    maxAge: 600,
  }),
)

app.onError((error, context) => {
  if (isHttpError(error)) {
    return context.json({ error: error.code }, error.status as 400)
  }
  console.error(
    JSON.stringify({
      event: 'worker_request_failed',
      method: context.req.method,
      path: context.req.path,
      reason: error instanceof Error ? error.name : 'unknown_error',
    }),
  )
  return context.json({ error: 'internal_error' }, 500)
})

app.get('/api/health', (context) => context.json({ status: 'ok' }))
app.get('/api/health/', (context) => context.json({ status: 'ok' }))
app.get('/api/push/config', (context) =>
  context.json({ publicKey: context.env.VAPID_PUBLIC_KEY?.trim() || null }),
)

// Upload and download URLs are short-lived, signed capabilities. They do not
// carry the Auth0 bearer token, so the capability itself is the only access
// credential accepted by these two object routes.
app.use('/api/*', async (context, next) => {
  const path = context.req.path
  const isCapabilityRoute =
    (path.startsWith('/api/attachments/') && path.endsWith('/upload')) ||
    (path.startsWith('/api/attachments/') && path.endsWith('/content'))
  if (isCapabilityRoute) return await next()
  return await requireAuth(context, next)
})

app.get('/api/users/me', async (context) => {
  const identity = context.get('user')
  const user = await userByToken(context.env, identity.tokenIdentifier)
  return context.json(user ? publicUser(user) : null)
})

app.post('/api/users/ensure', async (context) => {
  const user = await currentUser(context)
  return context.json(publicUser(user))
})

app.get('/api/settings', async (context) => {
  const user = await currentUser(context)
  const row = await context.env.DB.prepare(
    `SELECT timezone, push_enabled, email_notification_enabled FROM user_settings WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<{ timezone: string; push_enabled: number; email_notification_enabled: number }>()
  return context.json({
    timezone: row?.timezone ?? 'Asia/Tokyo',
    pushEnabled: Boolean(row?.push_enabled),
    emailNotificationEnabled: Boolean(row?.email_notification_enabled),
  })
})

app.patch('/api/settings', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<{
    timezone?: unknown
    pushEnabled?: unknown
    emailNotificationEnabled?: unknown
  }>(context)
  const timezone =
    typeof input.timezone === 'string' && input.timezone.trim()
      ? input.timezone.trim()
      : 'Asia/Tokyo'
  const pushEnabled = typeof input.pushEnabled === 'boolean' ? input.pushEnabled : false
  const emailNotificationEnabled =
    typeof input.emailNotificationEnabled === 'boolean' ? input.emailNotificationEnabled : false
  const now = Date.now()
  await context.env.DB.prepare(
    `INSERT INTO user_settings
       (user_id, timezone, push_enabled, email_notification_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET timezone = excluded.timezone,
       push_enabled = excluded.push_enabled,
       email_notification_enabled = excluded.email_notification_enabled,
       updated_at = excluded.updated_at`,
  )
    .bind(user.id, timezone, pushEnabled ? 1 : 0, emailNotificationEnabled ? 1 : 0, now, now)
    .run()
  return context.json({ timezone, pushEnabled, emailNotificationEnabled })
})

app.get('/api/letters', async (context) => {
  const user = await currentUser(context)
  const status = readLetterStatus(context.req.query('status'))
  return context.json(await listLetters(context.env, user.id, status))
})

app.post('/api/letters/drafts', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<Record<string, unknown>>(context)
  const parentLetterId = input.parentLetterId
  if (parentLetterId !== undefined && typeof parentLetterId !== 'string') {
    throw new HttpError(400, 'parent_letter_id_invalid')
  }
  return context.json(
    await createDraft(context.env, user, { parentLetterId } satisfies DraftInput),
    201,
  )
})

app.get('/api/letters/:letterId/metadata', async (context) => {
  const user = await currentUser(context)
  return context.json(await getMetadata(context.env, user.id, context.req.param('letterId')))
})

app.get('/api/letters/:letterId/draft', async (context) => {
  const user = await currentUser(context)
  return context.json(await getDraft(context.env, user.id, context.req.param('letterId')))
})

app.patch('/api/letters/:letterId/draft', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<{ body?: unknown }>(context)
  if (typeof input.body !== 'string') throw new HttpError(400, 'letter_body_required')
  await saveDraft(context.env, user.id, context.req.param('letterId'), input.body)
  return context.json(null)
})

app.patch('/api/letters/:letterId/settings', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<{ sealed?: unknown; deliveryMode?: unknown }>(context)
  if (typeof input.sealed !== 'boolean' || !isDeliveryMode(input.deliveryMode)) {
    throw new HttpError(400, 'draft_settings_invalid')
  }
  await saveDraftSettings(context.env, user.id, context.req.param('letterId'), {
    sealed: input.sealed,
    deliveryMode: input.deliveryMode,
  })
  return context.json(null)
})

app.post('/api/letters/:letterId/send', async (context) => {
  const user = await currentUser(context)
  return context.json(await sendLetter(context.env, user.id, context.req.param('letterId')))
})

app.delete('/api/letters/:letterId', async (context) => {
  const user = await currentUser(context)
  await deleteTravelingLetter(context.env, user.id, context.req.param('letterId'))
  return context.json(null)
})

app.post('/api/letters/:letterId/open', async (context) => {
  const user = await currentUser(context)
  return context.json(await openLetter(context.env, user.id, context.req.param('letterId')))
})

app.post('/api/letters/:letterId/force-deliver', async (context) => {
  const user = await currentUser(context)
  return context.json(await forceDeliverLetter(context.env, user.id, context.req.param('letterId')))
})

app.get('/api/letters/:letterId/content', async (context) => {
  const user = await currentUser(context)
  return context.json(await getReadableContent(context.env, user.id, context.req.param('letterId')))
})

app.get('/api/letters/:letterId/attachments', async (context) => {
  const user = await currentUser(context)
  return context.json(
    await listReadableAttachments(context.env, user.id, context.req.param('letterId')),
  )
})

app.post('/api/letters/:letterId/location', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<{ locationLabel?: unknown }>(context)
  if (typeof input.locationLabel !== 'string') throw new HttpError(400, 'location_label_required')
  return context.json({
    locationLabel: await upsertLocation(
      context.env,
      user.id,
      context.req.param('letterId'),
      input.locationLabel,
    ),
  })
})

app.delete('/api/letters/:letterId/location', async (context) => {
  const user = await currentUser(context)
  await removeLocation(context.env, user.id, context.req.param('letterId'))
  return context.json(null)
})

app.post('/api/letters/:letterId/attachments/intents', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<Partial<PhotoIntentInput>>(context)
  if (
    typeof input.mimeType !== 'string' ||
    typeof input.byteSize !== 'number' ||
    typeof input.width !== 'number' ||
    typeof input.height !== 'number'
  ) {
    throw new HttpError(400, 'photo_intent_invalid')
  }
  const intent = await createPhotoIntent(
    context.env,
    user.id,
    context.req.param('letterId'),
    input as PhotoIntentInput,
  )
  const url = new URL(
    `/api/attachments/${intent.attachmentId}/upload?capability=${encodeURIComponent(intent.uploadCapability)}`,
    context.req.url,
  )
  return context.json(
    {
      attachmentId: intent.attachmentId,
      generationToken: intent.generationToken,
      uploadUrl: url.toString(),
      expiresAt: intent.uploadExpiresAt,
    },
    201,
  )
})

app.delete('/api/attachments/:attachmentId', async (context) => {
  const user = await currentUser(context)
  const generationToken = context.req.query('generationToken')
  if (!generationToken) throw new HttpError(400, 'generation_token_required')
  await removePhoto(context.env, user.id, context.req.param('attachmentId'), generationToken)
  return context.json(null)
})

app.post('/api/attachments/:attachmentId/finalize', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<{ generationToken?: unknown }>(context)
  if (typeof input.generationToken !== 'string')
    throw new HttpError(400, 'generation_token_required')
  const attachment = await context.env.DB.prepare(
    `SELECT owner_id FROM letter_attachments WHERE id = ?`,
  )
    .bind(context.req.param('attachmentId'))
    .first<{ owner_id: string }>()
  if (!attachment || attachment.owner_id !== user.id)
    throw new HttpError(404, 'attachment_not_found')
  return context.json(
    await finalizePhoto(context.env, context.req.param('attachmentId'), input.generationToken),
  )
})

app.post('/api/attachments/:attachmentId/download-capability', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<{ generationToken?: unknown }>(context)
  if (typeof input.generationToken !== 'string')
    throw new HttpError(400, 'generation_token_required')
  const result = await createDownloadCapability(
    context.env,
    user.id,
    context.req.param('attachmentId'),
    input.generationToken,
  )
  if (!result) return context.json(null)
  const url = new URL(
    `/api/attachments/${context.req.param('attachmentId')}/content?capability=${encodeURIComponent(result.token)}`,
    context.req.url,
  )
  return context.json({ url: url.toString(), expiresAt: result.expiresAt })
})

app.put('/api/attachments/:attachmentId/upload', async (context) => {
  await uploadPhoto(
    context.env,
    context.req.param('attachmentId'),
    context.req.query('capability') ?? null,
    context.req.raw,
  )
  return new Response(null, { status: 201 })
})

app.get('/api/attachments/:attachmentId/content', async (context) => {
  const target = await getDownloadTarget(
    context.env,
    context.req.param('attachmentId'),
    context.req.query('capability') ?? null,
  )
  if (!target) throw new HttpError(404, 'attachment_not_found')
  const headers = new Headers({
    'Cache-Control': 'private, max-age=60',
    'Content-Type': target.contentType,
    'X-Content-Type-Options': 'nosniff',
  })
  if (target.etag) headers.set('ETag', target.etag)
  return new Response(target.body, { status: 200, headers })
})

app.get('/api/threads/:threadId', async (context) => {
  const user = await currentUser(context)
  return context.json(await getThreadView(context.env, user.id, context.req.param('threadId')))
})

app.get('/api/push/status', async (context) => {
  const user = await currentUser(context)
  return context.json(await getPushStatus(context.env, user.id, context.req.query('endpoint')))
})

app.put('/api/push/subscriptions', async (context) => {
  const user = await currentUser(context)
  const input = await readJson<{
    endpoint?: unknown
    p256dh?: unknown
    auth?: unknown
    userAgent?: unknown
  }>(context)
  if (
    typeof input.endpoint !== 'string' ||
    typeof input.p256dh !== 'string' ||
    typeof input.auth !== 'string' ||
    (input.userAgent !== undefined && typeof input.userAgent !== 'string')
  ) {
    throw new HttpError(400, 'push_subscription_invalid')
  }
  return context.json(
    await upsertPushSubscription(context.env, user.id, {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent,
    }),
  )
})

app.delete('/api/push/subscriptions', async (context) => {
  const user = await currentUser(context)
  const endpoint = context.req.query('endpoint')
  if (!endpoint) throw new HttpError(400, 'push_endpoint_required')
  return context.json(await disablePushSubscription(context.env, user.id, endpoint))
})

export function handleWorkerFetch(request: Request): Response {
  const url = new URL(request.url)
  if (url.pathname === '/api/health' || url.pathname === '/api/health/') {
    return Response.json({ status: 'ok' })
  }
  return new Response('Not found', { status: 404 })
}

async function currentUser(
  context: Parameters<typeof requireAuth>[0],
): Promise<Awaited<ReturnType<typeof getCurrentUser>>> {
  return await getCurrentUser(context.env, context.get('user'))
}

async function readJson<T>(context: Parameters<typeof requireAuth>[0]): Promise<T> {
  try {
    return (await context.req.json()) as T
  } catch {
    throw new HttpError(400, 'invalid_json')
  }
}

function readLetterStatus(value: string | undefined): 'draft' | 'traveling' | 'delivered' {
  if (value === 'draft' || value === 'traveling' || value === 'delivered') return value
  throw new HttpError(400, 'letter_status_invalid')
}

function isDeliveryMode(
  value: unknown,
): value is 'few_days' | 'few_weeks' | 'few_months' | 'about_year' | 'surprise' {
  return (
    value === 'few_days' ||
    value === 'few_weeks' ||
    value === 'few_months' ||
    value === 'about_year' ||
    value === 'surprise'
  )
}
