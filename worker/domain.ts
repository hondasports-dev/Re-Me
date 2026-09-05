import {
  attachmentsAreReadyForSend,
  assertBodyLength,
  canReadContent,
  getContent,
  getOwnedLetter,
  listAttachments,
  listOwnedMetadata,
  normalizeLocationLabel,
  toMetadata,
  toPublicAttachment,
  type AttachmentRow,
  type DraftView,
  type LetterMetadata,
  type PublicAttachment,
  type UserRow,
} from './db'
import {
  DELIVERY_SWEEP_LIMIT,
  DOWNLOAD_CAPABILITY_SECONDS,
  LOCK_TIMEOUT_MS,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_LETTER,
  NOTIFICATION_CLAIM_LIMIT,
  RECONCILIATION_LIMIT,
  UPLOAD_CAPABILITY_SECONDS,
  nextNotificationAvailableAt,
  resolveDeliveryWindow,
  type DeliveryMode,
  type LetterStatus,
} from './constants'
import { createCapability, verifyCapability } from './capability'
import { HttpError } from './errors'
import { inspectSanitizedPhoto, type InspectedPhoto } from './photo'
import type { AppEnv, AuthenticatedUser } from './types'

export interface DraftInput {
  parentLetterId?: string
}

export interface PhotoIntentInput {
  mimeType: string
  byteSize: number
  width: number
  height: number
}

export interface PhotoIntent {
  attachmentId: string
  generationToken: string
  uploadObjectKey: string
  uploadExpiresAt: number
  uploadCapability: string
}

export interface SentLetter {
  letterId: string
  threadId: string
  status: 'traveling'
  sealed: boolean
  deliveryMode: DeliveryMode
  deliveryWindowStart: number
  deliveryWindowEnd: number
  sentAt: number
}

export interface PushStatus {
  enabled: boolean
}

export async function createDraft(
  env: AppEnv,
  user: UserRow,
  input: DraftInput,
): Promise<{ letterId: string; threadId: string }> {
  const now = Date.now()
  const letterId = crypto.randomUUID()
  const threadId = input.parentLetterId
    ? await resolveReplyThread(env, user.id, input.parentLetterId)
    : crypto.randomUUID()

  if (input.parentLetterId) {
    const parent = await getOwnedLetter(env, user.id, input.parentLetterId)
    if (
      !canReadContent(parent, user.id) ||
      parent.status !== 'delivered' ||
      parent.nextLetterId !== null
    ) {
      throw new HttpError(409, 'parent_letter_not_replyable')
    }

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO letters
             (id, thread_id, owner_id, parent_letter_id, status, sealed, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)`,
        ).bind(letterId, threadId, user.id, parent.id, now, now),
        env.DB.prepare(
          `INSERT INTO letter_contents (letter_id, owner_id, body, created_at, updated_at)
           VALUES (?, ?, '', ?, ?)`,
        ).bind(letterId, user.id, now, now),
        env.DB.prepare(
          `UPDATE letters SET next_letter_id = ?, updated_at = ?
           WHERE id = ? AND owner_id = ? AND status = 'delivered' AND deleted_at IS NULL AND next_letter_id IS NULL`,
        ).bind(letterId, now, parent.id, user.id),
        env.DB.prepare(`UPDATE threads SET updated_at = ? WHERE id = ? AND owner_id = ?`).bind(
          now,
          threadId,
          user.id,
        ),
      ])
    } catch (error) {
      throw mapDatabaseError(error, 'parent_letter_not_replyable')
    }

    const current = await getOwnedLetter(env, user.id, parent.id)
    if (current.nextLetterId !== letterId) {
      await env.DB.prepare(`DELETE FROM letter_contents WHERE letter_id = ?`).bind(letterId).run()
      await env.DB.prepare(`DELETE FROM letters WHERE id = ? AND status = 'draft'`)
        .bind(letterId)
        .run()
      throw new HttpError(409, 'parent_letter_not_replyable')
    }

    return { letterId, threadId }
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO threads (id, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).bind(threadId, user.id, now, now),
    env.DB.prepare(
      `INSERT INTO letters (id, thread_id, owner_id, status, sealed, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', 1, ?, ?)`,
    ).bind(letterId, threadId, user.id, now, now),
    env.DB.prepare(
      `INSERT INTO letter_contents (letter_id, owner_id, body, created_at, updated_at)
       VALUES (?, ?, '', ?, ?)`,
    ).bind(letterId, user.id, now, now),
  ])
  return { letterId, threadId }
}

async function resolveReplyThread(
  env: AppEnv,
  userId: string,
  parentLetterId: string,
): Promise<string> {
  const parent = await getOwnedLetter(env, userId, parentLetterId)
  return parent.threadId
}

export async function saveDraft(
  env: AppEnv,
  userId: string,
  letterId: string,
  body: string,
): Promise<void> {
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status !== 'draft') throw new HttpError(409, 'letter_not_draft')
  assertBodyLength(body)
  const content = await getContent(env, letterId)
  if (!content) throw new HttpError(404, 'draft_content_not_found')
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare(`UPDATE letter_contents SET body = ?, updated_at = ? WHERE letter_id = ?`).bind(
      body,
      now,
      letterId,
    ),
    env.DB.prepare(`UPDATE letters SET updated_at = ? WHERE id = ? AND status = 'draft'`).bind(
      now,
      letterId,
    ),
    env.DB.prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`).bind(now, letter.threadId),
  ])
}

export async function getDraft(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<DraftView | null> {
  return await (async () => {
    const letter = await getOwnedLetterOrNull(env, userId, letterId)
    if (!letter || letter.status !== 'draft') return null
    const content = await getContent(env, letter.id)
    if (!content) return null
    const attachments = await listAttachments(env, letter.id)
    const location = attachments.find(
      (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
    )
    return {
      letterId: letter.id,
      threadId: letter.threadId,
      sealed: letter.sealed,
      deliveryMode: letter.deliveryMode,
      body: content.body,
      locationLabel: location?.locationLabel ?? null,
      attachmentsReady: attachmentsAreReadyForSend(attachments),
    }
  })()
}

export async function saveDraftSettings(
  env: AppEnv,
  userId: string,
  letterId: string,
  input: { sealed: boolean; deliveryMode: DeliveryMode },
): Promise<void> {
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status !== 'draft') throw new HttpError(409, 'letter_not_draft')
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE letters SET sealed = ?, delivery_mode = ?, updated_at = ?
       WHERE id = ? AND owner_id = ? AND status = 'draft'`,
    ).bind(input.sealed ? 1 : 0, input.deliveryMode, now, letterId, userId),
    env.DB.prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`).bind(now, letter.threadId),
  ])
}

export async function getMetadata(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<LetterMetadata | null> {
  const letter = await getOwnedLetterOrNull(env, userId, letterId)
  return letter ? toMetadata(letter) : null
}

export async function getReadableContent(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<{ letterId: string; body: string } | null> {
  const letter = await getOwnedLetterOrNull(env, userId, letterId)
  if (!letter || !canReadContent(letter, userId)) return null
  const content = await getContent(env, letter.id)
  return content ? { letterId: letter.id, body: content.body } : null
}

export async function listReadableAttachments(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<PublicAttachment[] | null> {
  const letter = await getOwnedLetterOrNull(env, userId, letterId)
  if (!letter || !canReadContent(letter, userId)) return null
  return (await listAttachments(env, letter.id))
    .filter((attachment) => attachment.status !== 'deleting')
    .map(toPublicAttachment)
}

export async function listLetters(
  env: AppEnv,
  userId: string,
  status: LetterStatus,
): Promise<LetterMetadata[]> {
  return await listOwnedMetadata(env, userId, status)
}

export async function openLetter(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<{ letterId: string; openedAt: number }> {
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status !== 'delivered') throw new HttpError(404, 'delivered_letter_not_found')
  const openedAt = letter.openedAt ?? Date.now()
  if (letter.openedAt === null) {
    await env.DB.prepare(
      `UPDATE letters SET opened_at = ?, updated_at = ?
       WHERE id = ? AND owner_id = ? AND status = 'delivered' AND opened_at IS NULL`,
    )
      .bind(openedAt, openedAt, letterId, userId)
      .run()
  }
  return { letterId, openedAt }
}

export async function deleteTravelingLetter(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<void> {
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status !== 'traveling') throw new HttpError(409, 'letter_not_traveling')
  const now = Date.now()
  const statements = [
    env.DB.prepare(
      `UPDATE letters SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND owner_id = ? AND status = 'traveling' AND deleted_at IS NULL`,
    ).bind(now, now, letterId, userId),
    env.DB.prepare(
      `UPDATE letter_deliveries SET status = 'canceled' WHERE letter_id = ? AND status = 'pending'`,
    ).bind(letterId),
    env.DB.prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`).bind(now, letter.threadId),
  ]
  if (letter.parentLetterId) {
    statements.push(
      env.DB.prepare(
        `UPDATE letters SET next_letter_id = NULL, replied_at = NULL, updated_at = ?
         WHERE id = ? AND next_letter_id = ?`,
      ).bind(now, letter.parentLetterId, letterId),
    )
  }
  await env.DB.batch(statements)
}

export async function sendLetter(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<SentLetter> {
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status === 'traveling') return toSentLetter(letter)
  if (letter.status !== 'draft') throw new HttpError(409, 'letter_not_draft')
  const content = await getContent(env, letterId)
  if (!content || content.body.trim().length === 0) throw new HttpError(400, 'letter_body_empty')
  assertBodyLength(content.body)
  if (!letter.deliveryMode) throw new HttpError(400, 'delivery_mode_required')
  const attachments = await listAttachments(env, letterId)
  if (!attachmentsAreReadyForSend(attachments)) throw new HttpError(409, 'attachments_not_ready')

  const now = Date.now()
  const schedule = resolveDeliveryWindow(now, letter.deliveryMode)
  const deliveryId = crypto.randomUUID()
  const statements = []
  if (letter.parentLetterId) {
    const parent = await getOwnedLetter(env, userId, letter.parentLetterId)
    if (!canReadContent(parent, userId) || parent.status !== 'delivered') {
      throw new HttpError(409, 'parent_letter_not_replyable')
    }
    if (parent.nextLetterId !== null && parent.nextLetterId !== letter.id) {
      throw new HttpError(409, 'parent_letter_already_claimed')
    }
    statements.push(
      env.DB.prepare(
        `UPDATE letters SET next_letter_id = ?, replied_at = ?, updated_at = ?
         WHERE id = ? AND owner_id = ? AND next_letter_id = ?`,
      ).bind(letter.id, now, now, parent.id, userId, letter.id),
    )
  }
  statements.push(
    env.DB.prepare(
      `INSERT INTO letter_deliveries
         (id, letter_id, owner_id, scheduled_at, status, attempt_count, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    ).bind(deliveryId, letter.id, userId, schedule.scheduledAt, now),
    env.DB.prepare(
      `UPDATE letters SET status = 'traveling', delivery_window_start = ?, delivery_window_end = ?,
         sent_at = ?, updated_at = ?
       WHERE id = ? AND owner_id = ? AND status = 'draft'`,
    ).bind(schedule.deliveryWindowStart, schedule.deliveryWindowEnd, now, now, letter.id, userId),
    env.DB.prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`).bind(now, letter.threadId),
  )

  try {
    await env.DB.batch(statements)
  } catch (error) {
    const current = await getOwnedLetter(env, userId, letterId)
    if (current.status === 'traveling') return toSentLetter(current)
    throw mapDatabaseError(error, 'letter_send_failed')
  }

  return {
    letterId: letter.id,
    threadId: letter.threadId,
    status: 'traveling',
    sealed: letter.sealed,
    deliveryMode: letter.deliveryMode,
    deliveryWindowStart: schedule.deliveryWindowStart,
    deliveryWindowEnd: schedule.deliveryWindowEnd,
    sentAt: now,
  }
}

function toSentLetter(letter: Awaited<ReturnType<typeof getOwnedLetter>>): SentLetter {
  if (
    letter.status !== 'traveling' ||
    !letter.deliveryMode ||
    letter.deliveryWindowStart === null ||
    letter.deliveryWindowEnd === null ||
    letter.sentAt === null
  ) {
    throw new HttpError(409, 'letter_not_sendable')
  }
  return {
    letterId: letter.id,
    threadId: letter.threadId,
    status: 'traveling',
    sealed: letter.sealed,
    deliveryMode: letter.deliveryMode,
    deliveryWindowStart: letter.deliveryWindowStart,
    deliveryWindowEnd: letter.deliveryWindowEnd,
    sentAt: letter.sentAt,
  }
}

export async function forceDeliverLetter(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<{ letterId: string; deliveredAt: number }> {
  if (
    (env.APP_ENV !== 'local' && env.APP_ENV !== 'preview') ||
    env.E2E_ALLOW_FORCE_DELIVERY !== '1'
  ) {
    throw new HttpError(404, 'not_found')
  }
  const letter = await getOwnedLetter(env, userId, letterId, { includeDeleted: true })
  if (letter.status === 'delivered' && letter.deliveredAt !== null) {
    return { letterId, deliveredAt: letter.deliveredAt }
  }
  if (letter.status !== 'traveling') throw new HttpError(409, 'letter_not_traveling')
  const result = await deliverOne(env, letterId, Date.now())
  if (result !== 'delivered') throw new HttpError(409, 'letter_could_not_be_delivered')
  const delivered = await getOwnedLetter(env, userId, letterId)
  if (delivered.deliveredAt === null) throw new HttpError(500, 'delivery_state_invalid')
  return { letterId, deliveredAt: delivered.deliveredAt }
}

export async function upsertLocation(
  env: AppEnv,
  userId: string,
  letterId: string,
  label: string,
): Promise<string> {
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status !== 'draft') throw new HttpError(409, 'letter_not_draft')
  const normalized = normalizeLocationLabel(label)
  const now = Date.now()
  const existing = (await listAttachments(env, letterId)).find(
    (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
  )
  if (existing) {
    await env.DB.prepare(
      `UPDATE letter_attachments SET location_label = ?, status = 'ready', updated_at = ?
       WHERE id = ? AND letter_id = ? AND owner_id = ? AND kind = 'location'`,
    )
      .bind(normalized, now, existing.id, letterId, userId)
      .run()
  } else {
    await env.DB.prepare(
      `INSERT INTO letter_attachments
         (id, letter_id, owner_id, kind, status, location_label, created_at, updated_at)
       VALUES (?, ?, ?, 'location', 'ready', ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), letterId, userId, normalized, now, now)
      .run()
  }
  await touchLetter(env, letter)
  return normalized
}

export async function removeLocation(env: AppEnv, userId: string, letterId: string): Promise<void> {
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status !== 'draft') throw new HttpError(409, 'letter_not_draft')
  await env.DB.prepare(
    `DELETE FROM letter_attachments WHERE letter_id = ? AND owner_id = ? AND kind = 'location'`,
  )
    .bind(letterId, userId)
    .run()
  await touchLetter(env, letter)
}

export async function createPhotoIntent(
  env: AppEnv,
  userId: string,
  letterId: string,
  input: PhotoIntentInput,
): Promise<PhotoIntent> {
  assertPhotoIntent(input)
  const letter = await getOwnedLetter(env, userId, letterId)
  if (letter.status !== 'draft') throw new HttpError(409, 'letter_not_draft')
  const attachments = await listAttachments(env, letterId)
  const activePhotos = attachments.filter(
    (attachment) => attachment.kind === 'photo' && attachment.status !== 'deleting',
  )
  if (activePhotos.length >= MAX_PHOTOS_PER_LETTER) throw new HttpError(400, 'photo_limit_reached')

  const generationToken = crypto.randomUUID()
  const uploadObjectKey = `staging/${letterId}/${generationToken}.jpg`
  const uploadExpiresAt = Date.now() + UPLOAD_CAPABILITY_SECONDS * 1_000
  const attachmentId = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO letter_attachments
       (id, letter_id, owner_id, kind, status, upload_r2_object_key, mime_type,
        byte_size, width, height, generation_token, upload_expires_at, created_at, updated_at)
     VALUES (?, ?, ?, 'photo', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      attachmentId,
      letterId,
      userId,
      uploadObjectKey,
      input.mimeType,
      input.byteSize,
      input.width,
      input.height,
      generationToken,
      uploadExpiresAt,
      Date.now(),
      Date.now(),
    )
    .run()
  const uploadCapability = await createCapability(env, {
    attachmentId,
    generationToken,
    purpose: 'upload',
    expiresAt: uploadExpiresAt,
  })
  return { attachmentId, generationToken, uploadObjectKey, uploadExpiresAt, uploadCapability }
}

export async function uploadPhoto(
  env: AppEnv,
  attachmentId: string,
  capability: string | null,
  request: Request,
): Promise<void> {
  const attachment = await getAttachment(env, attachmentId)
  if (
    !attachment ||
    attachment.kind !== 'photo' ||
    attachment.status !== 'pending' ||
    !attachment.generationToken
  ) {
    throw new HttpError(404, 'attachment_not_found')
  }
  await verifyUploadCapability(env, capability, attachment)
  if (
    !attachment.uploadR2ObjectKey ||
    attachment.uploadExpiresAt === null ||
    attachment.uploadExpiresAt < Date.now()
  ) {
    throw new HttpError(410, 'upload_capability_expired')
  }
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim()
  const contentLength = Number(request.headers.get('content-length'))
  if (
    contentType !== 'image/jpeg' ||
    !Number.isSafeInteger(contentLength) ||
    contentLength !== attachment.byteSize
  ) {
    throw new HttpError(400, 'photo_upload_metadata_mismatch')
  }
  if (await env.ATTACHMENTS_BUCKET.head(attachment.uploadR2ObjectKey)) {
    throw new HttpError(412, 'photo_upload_already_exists')
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength !== attachment.byteSize || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new HttpError(400, 'photo_upload_metadata_mismatch')
  }
  await env.ATTACHMENTS_BUCKET.put(attachment.uploadR2ObjectKey, bytes, {
    httpMetadata: { contentType: 'image/jpeg' },
  })
}

export async function finalizePhoto(
  env: AppEnv,
  attachmentId: string,
  generationToken: string,
): Promise<{ attachmentId: string }> {
  const attachment = await getAttachment(env, attachmentId)
  if (
    !attachment ||
    attachment.kind !== 'photo' ||
    attachment.generationToken !== generationToken
  ) {
    throw new HttpError(404, 'attachment_not_found')
  }
  if (attachment.status === 'ready') return { attachmentId }
  if (attachment.status !== 'pending' || !attachment.uploadR2ObjectKey) {
    throw new HttpError(409, 'photo_upload_unavailable')
  }
  if (attachment.uploadExpiresAt !== null && attachment.uploadExpiresAt < Date.now()) {
    await markAttachmentDeleting(env, attachment, 'upload_expired')
    throw new HttpError(410, 'upload_capability_expired')
  }
  const object = await env.ATTACHMENTS_BUCKET.head(attachment.uploadR2ObjectKey)
  if (
    !object ||
    object.size !== attachment.byteSize ||
    object.httpMetadata?.contentType !== 'image/jpeg'
  ) {
    await markAttachmentDeleting(env, attachment, 'upload_validation_failed')
    throw new HttpError(400, 'photo_upload_metadata_mismatch')
  }
  const uploaded = await env.ATTACHMENTS_BUCKET.get(attachment.uploadR2ObjectKey)
  if (!uploaded) {
    await markAttachmentDeleting(env, attachment, 'upload_missing')
    throw new HttpError(400, 'photo_upload_missing')
  }
  const uploadedBytes = new Uint8Array(await uploaded.arrayBuffer())
  let inspected: InspectedPhoto
  try {
    inspected = inspectSanitizedPhoto(uploadedBytes)
  } catch {
    await markAttachmentDeleting(env, attachment, 'upload_validation_failed')
    throw new HttpError(400, 'photo_upload_validation_failed')
  }
  if (
    inspected.byteSize !== attachment.byteSize ||
    inspected.width !== attachment.width ||
    inspected.height !== attachment.height
  ) {
    await markAttachmentDeleting(env, attachment, 'upload_validation_failed')
    throw new HttpError(400, 'photo_upload_metadata_mismatch')
  }

  const finalObjectKey = `final/${attachment.letterId}/${generationToken}.jpg`
  await env.ATTACHMENTS_BUCKET.put(finalObjectKey, uploadedBytes, {
    httpMetadata: { contentType: 'image/jpeg' },
  })
  const now = Date.now()
  const committed = await env.DB.prepare(
    `UPDATE letter_attachments SET status = 'ready', r2_object_key = ?, upload_r2_object_key = NULL,
       content_etag = ?, upload_expires_at = NULL, last_error_code = NULL, updated_at = ?
     WHERE id = ? AND generation_token = ? AND status = 'pending'`,
  )
    .bind(finalObjectKey, object.etag, now, attachmentId, generationToken)
    .run()
  if (committed.meta.changes !== 1) {
    await env.ATTACHMENTS_BUCKET.delete(finalObjectKey)
    return { attachmentId }
  }
  await env.ATTACHMENTS_BUCKET.delete(attachment.uploadR2ObjectKey)
  await touchLetterById(env, attachment.letterId, now)
  return { attachmentId }
}

export async function removePhoto(
  env: AppEnv,
  userId: string,
  attachmentId: string,
  generationToken: string,
): Promise<void> {
  const attachment = await getAttachment(env, attachmentId)
  if (
    !attachment ||
    attachment.ownerId !== userId ||
    attachment.kind !== 'photo' ||
    attachment.generationToken !== generationToken
  ) {
    throw new HttpError(404, 'draft_photo_not_found')
  }
  const letter = await getOwnedLetter(env, userId, attachment.letterId)
  if (letter.status !== 'draft') throw new HttpError(409, 'letter_not_draft')
  await markAttachmentDeleting(env, attachment, null)
  await deleteAttachmentObjects(env, attachment)
  await env.DB.prepare(`DELETE FROM letter_attachments WHERE id = ? AND status = 'deleting'`)
    .bind(attachmentId)
    .run()
  await touchLetter(env, letter)
}

export async function createDownloadCapability(
  env: AppEnv,
  userId: string,
  attachmentId: string,
  generationToken: string,
): Promise<{ token: string; expiresAt: number } | null> {
  const attachment = await getAttachment(env, attachmentId)
  if (
    !attachment ||
    attachment.ownerId !== userId ||
    attachment.kind !== 'photo' ||
    attachment.status !== 'ready' ||
    attachment.generationToken !== generationToken ||
    !attachment.r2ObjectKey
  ) {
    return null
  }
  const expiresAt = Date.now() + DOWNLOAD_CAPABILITY_SECONDS * 1_000
  return {
    token: await createCapability(env, {
      attachmentId,
      generationToken,
      purpose: 'download',
      expiresAt,
    }),
    expiresAt,
  }
}

export async function getDownloadTarget(
  env: AppEnv,
  attachmentId: string,
  token: string | null,
): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; etag: string | null } | null> {
  const attachment = await getAttachment(env, attachmentId)
  if (
    !attachment ||
    attachment.kind !== 'photo' ||
    attachment.status !== 'ready' ||
    !attachment.r2ObjectKey ||
    !attachment.generationToken
  ) {
    throw new HttpError(404, 'attachment_not_found')
  }
  await verifyDownloadCapability(env, token, attachment)
  const object = await env.ATTACHMENTS_BUCKET.get(attachment.r2ObjectKey)
  if (!object) throw new HttpError(404, 'attachment_not_found')
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType ?? 'image/jpeg',
    etag: object.etag ?? attachment.contentEtag,
  }
}

export async function getPushStatus(
  env: AppEnv,
  userId: string,
  endpoint?: string,
): Promise<PushStatus> {
  if (endpoint) {
    const row = await env.DB.prepare(
      `SELECT id, owner_id, endpoint, p256dh, auth, user_agent, created_at, updated_at, disabled_at
       FROM push_subscriptions WHERE endpoint = ? LIMIT 1`,
    )
      .bind(endpoint)
      .first<PushSubscriptionResult>()
    return { enabled: Boolean(row && row.owner_id === userId && row.disabled_at === null) }
  }
  const row = await env.DB.prepare(
    `SELECT id FROM push_subscriptions WHERE owner_id = ? AND disabled_at IS NULL LIMIT 1`,
  )
    .bind(userId)
    .first<{ id: string }>()
  return { enabled: Boolean(row) }
}

export async function upsertPushSubscription(
  env: AppEnv,
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
): Promise<PushStatus> {
  validatePushSubscription(input)
  const now = Date.now()
  const existing = await env.DB.prepare(
    `SELECT owner_id FROM push_subscriptions WHERE endpoint = ?`,
  )
    .bind(input.endpoint)
    .first<{ owner_id: string }>()
  if (existing && existing.owner_id !== userId)
    throw new HttpError(409, 'push_subscription_owned_by_other_user')
  if (existing) {
    await env.DB.prepare(
      `UPDATE push_subscriptions SET p256dh = ?, auth = ?, user_agent = ?, disabled_at = NULL, updated_at = ?
       WHERE endpoint = ? AND owner_id = ?`,
    )
      .bind(input.p256dh, input.auth, input.userAgent ?? null, now, input.endpoint, userId)
      .run()
  } else {
    await env.DB.prepare(
      `INSERT INTO push_subscriptions
         (id, owner_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        userId,
        input.endpoint,
        input.p256dh,
        input.auth,
        input.userAgent ?? null,
        now,
        now,
      )
      .run()
  }
  return { enabled: true }
}

export async function disablePushSubscription(
  env: AppEnv,
  userId: string,
  endpoint: string,
): Promise<{ enabled: false; owned: boolean }> {
  const row = await env.DB.prepare(
    `SELECT owner_id, disabled_at FROM push_subscriptions WHERE endpoint = ?`,
  )
    .bind(endpoint)
    .first<{ owner_id: string; disabled_at: number | null }>()
  if (!row || row.owner_id !== userId) return { enabled: false, owned: false }
  if (row.disabled_at === null) {
    const now = Date.now()
    await env.DB.prepare(
      `UPDATE push_subscriptions SET disabled_at = ?, updated_at = ? WHERE endpoint = ? AND owner_id = ?`,
    )
      .bind(now, now, endpoint, userId)
      .run()
  }
  return { enabled: false, owned: true }
}

export async function sweepDeliveryAndNotification(
  env: AppEnv,
  now = Date.now(),
): Promise<{
  canceledCount: number
  deliveredCount: number
  claimed: Array<{ jobId: string; generationToken: string }>
}> {
  const due = await env.DB.prepare(
    `SELECT id, letter_id, owner_id, scheduled_at, status, attempt_count, last_attempt_at, created_at
     FROM letter_deliveries WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC LIMIT ?`,
  )
    .bind(now, DELIVERY_SWEEP_LIMIT)
    .all<DeliveryResult>()
  let canceledCount = 0
  let deliveredCount = 0
  for (const delivery of due.results) {
    const result = await deliverOne(env, delivery.letter_id, now)
    if (result === 'delivered') deliveredCount += 1
    if (result === 'canceled') canceledCount += 1
  }
  const claimed = await claimNotificationJobs(env, now)
  return { canceledCount, deliveredCount, claimed }
}

async function deliverOne(
  env: AppEnv,
  letterId: string,
  now: number,
): Promise<'delivered' | 'canceled' | 'skipped'> {
  const delivery = await env.DB.prepare(
    `SELECT status, owner_id FROM letter_deliveries WHERE letter_id = ?`,
  )
    .bind(letterId)
    .first<{ status: 'pending' | 'consumed' | 'canceled'; owner_id: string }>()
  if (!delivery || delivery.status !== 'pending') return 'skipped'
  const letter = await getLetterForInternal(env, letterId)
  if (!letter || letter.deletedAt !== null || letter.status !== 'traveling') {
    await env.DB.prepare(
      `UPDATE letter_deliveries SET status = 'canceled', last_attempt_at = ?, attempt_count = attempt_count + 1
       WHERE letter_id = ? AND status = 'pending'`,
    )
      .bind(now, letterId)
      .run()
    return 'canceled'
  }
  const jobId = crypto.randomUUID()
  const generationToken = crypto.randomUUID()
  const result = await env.DB.batch([
    env.DB.prepare(
      `UPDATE letters SET status = 'delivered', delivered_at = ?, updated_at = ?
       WHERE id = ? AND status = 'traveling' AND deleted_at IS NULL`,
    ).bind(now, now, letterId),
    env.DB.prepare(
      `UPDATE letter_deliveries SET status = 'consumed', last_attempt_at = ?, attempt_count = attempt_count + 1
       WHERE letter_id = ? AND status = 'pending'`,
    ).bind(now, letterId),
    env.DB.prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`).bind(now, letter.threadId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO notification_jobs
         (id, letter_id, owner_id, status, attempt_count, generation_token, available_at, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
    ).bind(jobId, letterId, letter.ownerId, generationToken, now, now, now),
  ])
  const deliveredChange = result[0]?.meta.changes ?? 0
  return deliveredChange === 1 || (await wasLetterDelivered(env, letterId))
    ? 'delivered'
    : 'skipped'
}

async function wasLetterDelivered(env: AppEnv, letterId: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT status FROM letters WHERE id = ?`)
    .bind(letterId)
    .first<{ status: LetterStatus }>()
  return row?.status === 'delivered'
}

export async function claimNotificationJobs(
  env: AppEnv,
  now = Date.now(),
): Promise<Array<{ jobId: string; generationToken: string }>> {
  const jobs = await env.DB.prepare(
    `SELECT id, status, attempt_count, generation_token, available_at, locked_at
     FROM notification_jobs
     WHERE (status IN ('pending', 'failed') AND available_at <= ?)
        OR (status = 'processing' AND locked_at IS NOT NULL AND locked_at <= ?)
     ORDER BY available_at ASC LIMIT ?`,
  )
    .bind(now, now - LOCK_TIMEOUT_MS, NOTIFICATION_CLAIM_LIMIT)
    .all<NotificationJobResult>()
  const claimed: Array<{ jobId: string; generationToken: string }> = []
  for (const job of jobs.results) {
    if (claimed.length >= NOTIFICATION_CLAIM_LIMIT) break
    const generationToken = crypto.randomUUID()
    const result = await env.DB.prepare(
      `UPDATE notification_jobs SET status = 'processing', generation_token = ?, locked_at = ?,
         available_at = ?, updated_at = ?
       WHERE id = ? AND (
         (status IN ('pending', 'failed') AND available_at <= ?)
         OR (status = 'processing' AND locked_at IS NOT NULL AND locked_at <= ?)
       )`,
    )
      .bind(generationToken, now, now + LOCK_TIMEOUT_MS, now, job.id, now, now - LOCK_TIMEOUT_MS)
      .run()
    if (result.meta.changes === 1) claimed.push({ jobId: job.id, generationToken })
  }
  return claimed
}

export async function getNotificationSendTarget(
  env: AppEnv,
  jobId: string,
  generationToken: string,
): Promise<{
  ownerId: string
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>
} | null> {
  const job = await env.DB.prepare(
    `SELECT owner_id, status, generation_token FROM notification_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<{ owner_id: string; status: string; generation_token: string }>()
  if (!job || job.status !== 'processing' || job.generation_token !== generationToken) return null
  const rows = await env.DB.prepare(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE owner_id = ? AND disabled_at IS NULL LIMIT 20`,
  )
    .bind(job.owner_id)
    .all<{ endpoint: string; p256dh: string; auth: string }>()
  return { ownerId: job.owner_id, subscriptions: rows.results }
}

export async function completeNotificationJob(
  env: AppEnv,
  jobId: string,
  generationToken: string,
  outcome: { kind: 'sent' } | { kind: 'failed'; errorCode: string },
  now = Date.now(),
): Promise<boolean> {
  const job = await env.DB.prepare(
    `SELECT status, generation_token, attempt_count FROM notification_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<{ status: string; generation_token: string; attempt_count: number }>()
  if (!job || job.status !== 'processing' || job.generation_token !== generationToken) return false
  if (outcome.kind === 'sent') {
    await env.DB.prepare(
      `UPDATE notification_jobs SET status = 'sent', sent_at = ?, locked_at = NULL, last_error_code = NULL, updated_at = ?
       WHERE id = ? AND status = 'processing' AND generation_token = ?`,
    )
      .bind(now, now, jobId, generationToken)
      .run()
    return true
  }
  const attemptCount = job.attempt_count + 1
  await env.DB.prepare(
    `UPDATE notification_jobs SET status = 'failed', attempt_count = ?, available_at = ?, locked_at = NULL,
       last_error_code = ?, updated_at = ?
     WHERE id = ? AND status = 'processing' AND generation_token = ?`,
  )
    .bind(
      attemptCount,
      nextNotificationAvailableAt(now, attemptCount),
      sanitizeNotificationErrorCode(outcome.errorCode),
      now,
      jobId,
      generationToken,
    )
    .run()
  return true
}

export async function disablePushForOwner(
  env: AppEnv,
  ownerId: string,
  endpoint: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE push_subscriptions SET disabled_at = COALESCE(disabled_at, ?), updated_at = ? WHERE owner_id = ? AND endpoint = ?`,
  )
    .bind(Date.now(), Date.now(), ownerId, endpoint)
    .run()
}

export async function reconcileAttachments(env: AppEnv, now = Date.now()): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT id, letter_id, owner_id, kind, status, r2_object_key, upload_r2_object_key,
       content_etag, mime_type, byte_size, width, height, generation_token, upload_expires_at,
       delete_attempt_count, next_reconcile_at, last_error_code, location_label, created_at, updated_at
     FROM letter_attachments
     WHERE (status = 'pending' AND upload_expires_at IS NOT NULL AND upload_expires_at <= ?)
        OR (status = 'deleting' AND (next_reconcile_at IS NULL OR next_reconcile_at <= ?))
     ORDER BY created_at ASC LIMIT ?`,
  )
    .bind(now, now, RECONCILIATION_LIMIT)
    .all<AttachmentResult>()
  let count = 0
  for (const row of rows.results) {
    const attachment = toAttachment(row)
    if (attachment.status === 'pending')
      await markAttachmentDeleting(env, attachment, 'upload_expired')
    await deleteAttachmentObjects(env, attachment)
    await env.DB.prepare(`DELETE FROM letter_attachments WHERE id = ? AND status = 'deleting'`)
      .bind(attachment.id)
      .run()
    count += 1
  }
  return count
}

export async function getCurrentUser(env: AppEnv, identity: AuthenticatedUser): Promise<UserRow> {
  const existing = await env.DB.prepare(
    `SELECT id, token_identifier, email, name, picture_url, created_at, updated_at FROM users WHERE token_identifier = ? LIMIT 1`,
  )
    .bind(identity.tokenIdentifier)
    .first<UserResult>()
  const now = Date.now()
  if (existing) {
    await env.DB.prepare(
      `UPDATE users SET email = ?, name = ?, picture_url = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(
        identity.email ?? null,
        identity.name ?? null,
        identity.pictureUrl ?? null,
        now,
        existing.id,
      )
      .run()
    await ensureSettings(env, existing.id, now)
    return await userById(env, existing.id)
  }
  const id = crypto.randomUUID()
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, token_identifier, email, name, picture_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        identity.tokenIdentifier,
        identity.email ?? null,
        identity.name ?? null,
        identity.pictureUrl ?? null,
        now,
        now,
      )
      .run()
  } catch (error) {
    const raced = await env.DB.prepare(`SELECT id FROM users WHERE token_identifier = ? LIMIT 1`)
      .bind(identity.tokenIdentifier)
      .first<{ id: string }>()
    if (!raced) throw mapDatabaseError(error, 'user_provision_failed')
    await ensureSettings(env, raced.id, now)
    return await userById(env, raced.id)
  }
  await ensureSettings(env, id, now)
  return await userById(env, id)
}

async function ensureSettings(env: AppEnv, userId: string, now: number): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_settings
       (user_id, timezone, push_enabled, email_notification_enabled, created_at, updated_at)
     VALUES (?, 'Asia/Tokyo', 0, 0, ?, ?)`,
  )
    .bind(userId, now, now)
    .run()
}

export async function userByToken(env: AppEnv, tokenIdentifier: string): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, token_identifier, email, name, picture_url, created_at, updated_at FROM users WHERE token_identifier = ? LIMIT 1`,
  )
    .bind(tokenIdentifier)
    .first<UserResult>()
  return row ? toUser(row) : null
}

export function publicUser(user: UserRow): {
  userId: string
  email?: string
  name?: string
  pictureUrl?: string
} {
  return {
    userId: user.id,
    ...(user.email ? { email: user.email } : {}),
    ...(user.name ? { name: user.name } : {}),
    ...(user.pictureUrl ? { pictureUrl: user.pictureUrl } : {}),
  }
}

async function userById(env: AppEnv, id: string): Promise<UserRow> {
  const row = await env.DB.prepare(
    `SELECT id, token_identifier, email, name, picture_url, created_at, updated_at FROM users WHERE id = ?`,
  )
    .bind(id)
    .first<UserResult>()
  if (!row) throw new HttpError(500, 'user_provision_failed')
  return toUser(row)
}

async function getOwnedLetterOrNull(env: AppEnv, userId: string, letterId: string) {
  const row = await env.DB.prepare(
    `SELECT id, thread_id, owner_id, parent_letter_id, next_letter_id, status, sealed,
       delivery_mode, delivery_window_start, delivery_window_end, sent_at, delivered_at,
       opened_at, replied_at, created_at, updated_at, deleted_at
     FROM letters WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`,
  )
    .bind(letterId, userId)
    .first<LetterResult>()
  return row ? toLetter(row) : null
}

async function getLetterForInternal(env: AppEnv, letterId: string) {
  const row = await env.DB.prepare(
    `SELECT id, thread_id, owner_id, parent_letter_id, next_letter_id, status, sealed,
       delivery_mode, delivery_window_start, delivery_window_end, sent_at, delivered_at,
       opened_at, replied_at, created_at, updated_at, deleted_at
     FROM letters WHERE id = ?`,
  )
    .bind(letterId)
    .first<LetterResult>()
  return row ? toLetter(row) : null
}

async function touchLetter(
  env: AppEnv,
  letter: Awaited<ReturnType<typeof getOwnedLetter>>,
): Promise<void> {
  await touchLetterById(env, letter.id, Date.now(), letter.threadId)
}

async function touchLetterById(
  env: AppEnv,
  letterId: string,
  now: number,
  threadId?: string,
): Promise<void> {
  await env.DB.prepare(`UPDATE letters SET updated_at = ? WHERE id = ?`).bind(now, letterId).run()
  const resolvedThreadId = threadId ?? (await getLetterForInternal(env, letterId))?.threadId
  if (resolvedThreadId)
    await env.DB.prepare(`UPDATE threads SET updated_at = ? WHERE id = ?`)
      .bind(now, resolvedThreadId)
      .run()
}

async function getAttachment(env: AppEnv, attachmentId: string): Promise<AttachmentRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, letter_id, owner_id, kind, status, r2_object_key, upload_r2_object_key,
       content_etag, mime_type, byte_size, width, height, generation_token, upload_expires_at,
       delete_attempt_count, next_reconcile_at, last_error_code, location_label, created_at, updated_at
     FROM letter_attachments WHERE id = ?`,
  )
    .bind(attachmentId)
    .first<AttachmentResult>()
  return row ? toAttachment(row) : null
}

async function markAttachmentDeleting(
  env: AppEnv,
  attachment: AttachmentRow,
  errorCode: string | null,
): Promise<void> {
  const now = Date.now()
  await env.DB.prepare(
    `UPDATE letter_attachments SET status = 'deleting', next_reconcile_at = ?, last_error_code = ?, updated_at = ?
     WHERE id = ? AND status <> 'deleting'`,
  )
    .bind(now, errorCode, now, attachment.id)
    .run()
}

async function deleteAttachmentObjects(env: AppEnv, attachment: AttachmentRow): Promise<void> {
  for (const key of [attachment.uploadR2ObjectKey, attachment.r2ObjectKey]) {
    if (!key) continue
    try {
      await env.ATTACHMENTS_BUCKET.delete(key)
    } catch {
      const next = Date.now() + 60_000
      await env.DB.prepare(
        `UPDATE letter_attachments SET delete_attempt_count = COALESCE(delete_attempt_count, 0) + 1,
           next_reconcile_at = ?, last_error_code = 'r2_delete_failed', updated_at = ? WHERE id = ?`,
      )
        .bind(next, Date.now(), attachment.id)
        .run()
      throw new HttpError(503, 'attachment_cleanup_pending')
    }
  }
}

async function verifyUploadCapability(
  env: AppEnv,
  token: string | null,
  attachment: AttachmentRow,
): Promise<void> {
  await verifyCapability(env, token, {
    attachmentId: attachment.id,
    generationToken: attachment.generationToken ?? '',
    purpose: 'upload',
  })
}

async function verifyDownloadCapability(
  env: AppEnv,
  token: string | null,
  attachment: AttachmentRow,
): Promise<void> {
  await verifyCapability(env, token, {
    attachmentId: attachment.id,
    generationToken: attachment.generationToken ?? '',
    purpose: 'download',
  })
}

function assertPhotoIntent(input: PhotoIntentInput): void {
  if (input.mimeType !== 'image/jpeg') throw new HttpError(400, 'photo_must_be_jpeg')
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > MAX_PHOTO_BYTES
  ) {
    throw new HttpError(400, 'photo_size_invalid')
  }
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width <= 0 ||
    input.height <= 0 ||
    input.width > 4096 ||
    input.height > 4096
  ) {
    throw new HttpError(400, 'photo_dimensions_invalid')
  }
}

function validatePushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}): void {
  let url: URL
  try {
    url = new URL(input.endpoint)
  } catch {
    throw new HttpError(400, 'push_endpoint_invalid')
  }
  if (
    url.protocol !== 'https:' ||
    input.endpoint.length > 2048 ||
    input.p256dh.length > 256 ||
    input.auth.length > 256 ||
    (input.userAgent?.length ?? 0) > 256
  ) {
    throw new HttpError(400, 'push_subscription_invalid')
  }
}

function sanitizeNotificationErrorCode(code: string): 'push_failed' | 'push_config_missing' {
  return code === 'push_config_missing' ? 'push_config_missing' : 'push_failed'
}

function mapDatabaseError(error: unknown, fallback: string): HttpError {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('UNIQUE') || message.includes('constraint'))
    return new HttpError(409, fallback)
  return new HttpError(500, fallback)
}

type UserResult = {
  id: string
  token_identifier: string
  email: string | null
  name: string | null
  picture_url: string | null
  created_at: number
  updated_at: number
}
type LetterResult = {
  id: string
  thread_id: string
  owner_id: string
  parent_letter_id: string | null
  next_letter_id: string | null
  status: LetterStatus
  sealed: number
  delivery_mode: DeliveryMode | null
  delivery_window_start: number | null
  delivery_window_end: number | null
  sent_at: number | null
  delivered_at: number | null
  opened_at: number | null
  replied_at: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}
type AttachmentResult = {
  id: string
  letter_id: string
  owner_id: string
  kind: 'photo' | 'location'
  status: 'pending' | 'ready' | 'deleting'
  r2_object_key: string | null
  upload_r2_object_key: string | null
  content_etag: string | null
  mime_type: string | null
  byte_size: number | null
  width: number | null
  height: number | null
  generation_token: string | null
  upload_expires_at: number | null
  delete_attempt_count: number | null
  next_reconcile_at: number | null
  last_error_code: string | null
  location_label: string | null
  created_at: number
  updated_at: number | null
}
type DeliveryResult = { letter_id: string }
type NotificationJobResult = {
  id: string
  status: string
  available_at: number
  locked_at: number | null
}
type PushSubscriptionResult = {
  id: string
  owner_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: number
  updated_at: number
  disabled_at: number | null
}

function toUser(row: UserResult): UserRow {
  return {
    id: row.id,
    tokenIdentifier: row.token_identifier,
    email: row.email,
    name: row.name,
    pictureUrl: row.picture_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toLetter(row: LetterResult) {
  return {
    id: row.id,
    threadId: row.thread_id,
    ownerId: row.owner_id,
    parentLetterId: row.parent_letter_id,
    nextLetterId: row.next_letter_id,
    status: row.status,
    sealed: Boolean(row.sealed),
    deliveryMode: row.delivery_mode,
    deliveryWindowStart: row.delivery_window_start,
    deliveryWindowEnd: row.delivery_window_end,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    openedAt: row.opened_at,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

function toAttachment(row: AttachmentResult): AttachmentRow {
  return {
    id: row.id,
    letterId: row.letter_id,
    ownerId: row.owner_id,
    kind: row.kind,
    status: row.status,
    r2ObjectKey: row.r2_object_key,
    uploadR2ObjectKey: row.upload_r2_object_key,
    contentEtag: row.content_etag,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    generationToken: row.generation_token,
    uploadExpiresAt: row.upload_expires_at,
    deleteAttemptCount: row.delete_attempt_count,
    nextReconcileAt: row.next_reconcile_at,
    lastErrorCode: row.last_error_code,
    locationLabel: row.location_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
