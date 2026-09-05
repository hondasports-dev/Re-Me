import {
  LETTER_LIST_LIMIT,
  MAX_LETTER_BODY_LENGTH,
  MAX_LOCATION_LABEL_LENGTH,
  THREAD_LETTER_LIMIT,
  deliveryWindowDays,
  type AttachmentStatus,
  type DeliveryMode,
  type LetterStatus,
} from './constants'
import { HttpError } from './errors'
import type { AppEnv, AuthenticatedUser } from './types'

export interface UserRow {
  id: string
  tokenIdentifier: string
  email: string | null
  name: string | null
  pictureUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface LetterRow {
  id: string
  threadId: string
  ownerId: string
  parentLetterId: string | null
  nextLetterId: string | null
  status: LetterStatus
  sealed: boolean
  deliveryMode: DeliveryMode | null
  deliveryWindowStart: number | null
  deliveryWindowEnd: number | null
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  repliedAt: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface LetterContentRow {
  letterId: string
  ownerId: string
  body: string
  createdAt: number
  updatedAt: number
}

export interface AttachmentRow {
  id: string
  letterId: string
  ownerId: string
  kind: 'photo' | 'location'
  status: AttachmentStatus
  r2ObjectKey: string | null
  uploadR2ObjectKey: string | null
  contentEtag: string | null
  mimeType: string | null
  byteSize: number | null
  width: number | null
  height: number | null
  generationToken: string | null
  uploadExpiresAt: number | null
  deleteAttemptCount: number | null
  nextReconcileAt: number | null
  lastErrorCode: string | null
  locationLabel: string | null
  createdAt: number
  updatedAt: number | null
}

export interface DeliveryRow {
  id: string
  letterId: string
  ownerId: string
  scheduledAt: number
  status: 'pending' | 'consumed' | 'canceled'
  attemptCount: number
  lastAttemptAt: number | null
  createdAt: number
}

export interface PushSubscriptionRow {
  id: string
  ownerId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string | null
  createdAt: number
  updatedAt: number
  disabledAt: number | null
}

export interface PublicUser {
  userId: string
  email?: string
  name?: string
  pictureUrl?: string
}

export interface LetterMetadata {
  letterId: string
  threadId: string
  parentLetterId: string | null
  nextLetterId: string | null
  status: LetterStatus
  sealed: boolean
  deliveryMode: DeliveryMode | null
  deliveryWindowStart: number | null
  deliveryWindowEnd: number | null
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  repliedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface DraftView {
  letterId: string
  threadId: string
  sealed: boolean
  deliveryMode: DeliveryMode | null
  body: string
  locationLabel: string | null
  attachmentsReady: boolean
}

export interface PublicAttachment {
  attachmentId: string
  kind: AttachmentRow['kind']
  status: AttachmentStatus
  generationToken: string | null
  mimeType: string | null
  byteSize: number | null
  width: number | null
  height: number | null
  locationLabel: string | null
}

export interface ThreadSegment {
  letterId: string
  parentLetterId: string | null
  status: LetterStatus
  sealed: boolean
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  deleted: boolean
  body: string | null
  locationLabel: string | null
}

const LETTER_SELECT = `
  SELECT id, thread_id, owner_id, parent_letter_id, next_letter_id, status,
         sealed, delivery_mode, delivery_window_start, delivery_window_end,
         sent_at, delivered_at, opened_at, replied_at, created_at, updated_at,
         deleted_at
  FROM letters
`

const ATTACHMENT_SELECT = `
  SELECT id, letter_id, owner_id, kind, status, r2_object_key,
         upload_r2_object_key, content_etag, mime_type, byte_size, width,
         height, generation_token, upload_expires_at, delete_attempt_count,
         next_reconcile_at, last_error_code, location_label, created_at,
         updated_at
  FROM letter_attachments
`

export async function findUserByTokenIdentifier(
  env: AppEnv,
  tokenIdentifier: string,
): Promise<UserRow | null> {
  return await env.DB.prepare(
    `SELECT id, token_identifier, email, name, picture_url, created_at, updated_at
     FROM users WHERE token_identifier = ? ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(tokenIdentifier)
    .first<UserRowResult>()
    .then((row) => (row ? toUserRow(row) : null))
}

export async function ensureUser(env: AppEnv, identity: AuthenticatedUser): Promise<UserRow> {
  const existing = await findUserByTokenIdentifier(env, identity.tokenIdentifier)
  const now = Date.now()

  if (existing) {
    await env.DB.prepare(
      `UPDATE users
       SET email = ?, name = ?, picture_url = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        identity.email ?? null,
        identity.name ?? null,
        identity.pictureUrl ?? null,
        now,
        existing.id,
      )
      .run()
    return (await getUserById(env, existing.id)) ?? existing
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users
       (id, token_identifier, email, name, picture_url, created_at, updated_at)
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

  const user = await findUserByTokenIdentifier(env, identity.tokenIdentifier)
  if (!user) {
    throw new HttpError(500, 'user_provision_failed')
  }
  return user
}

export async function getUserById(env: AppEnv, userId: string): Promise<UserRow | null> {
  return await env.DB.prepare(
    `SELECT id, token_identifier, email, name, picture_url, created_at, updated_at
     FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<UserRowResult>()
    .then((row) => (row ? toUserRow(row) : null))
}

export function toPublicUser(user: UserRow): PublicUser {
  return {
    userId: user.id,
    ...(user.email ? { email: user.email } : {}),
    ...(user.name ? { name: user.name } : {}),
    ...(user.pictureUrl ? { pictureUrl: user.pictureUrl } : {}),
  }
}

export async function getLetter(env: AppEnv, letterId: string): Promise<LetterRow | null> {
  return await env.DB.prepare(`${LETTER_SELECT} WHERE id = ?`)
    .bind(letterId)
    .first<LetterRowResult>()
    .then((row) => (row ? toLetterRow(row) : null))
}

export async function getOwnedLetter(
  env: AppEnv,
  userId: string,
  letterId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<LetterRow> {
  const letter = await getLetter(env, letterId)
  if (
    !letter ||
    letter.ownerId !== userId ||
    (!options.includeDeleted && letter.deletedAt !== null)
  ) {
    throw new HttpError(404, 'letter_not_found')
  }
  return letter
}

export async function getContent(env: AppEnv, letterId: string): Promise<LetterContentRow | null> {
  const row = await env.DB.prepare(
    `SELECT letter_id, owner_id, body, created_at, updated_at
     FROM letter_contents WHERE letter_id = ?`,
  )
    .bind(letterId)
    .first<LetterContentResult>()
  return row ? toContentRow(row) : null
}

export async function listAttachments(env: AppEnv, letterId: string): Promise<AttachmentRow[]> {
  const result = await env.DB.prepare(
    `${ATTACHMENT_SELECT} WHERE letter_id = ? ORDER BY created_at ASC LIMIT 20`,
  )
    .bind(letterId)
    .all<AttachmentResult>()
  return result.results.map(toAttachmentRow)
}

export function attachmentsAreReadyForSend(attachments: AttachmentRow[]): boolean {
  return attachments.length < 20 && attachments.every((attachment) => attachment.status === 'ready')
}

export function toPublicAttachment(attachment: AttachmentRow): PublicAttachment {
  return {
    attachmentId: attachment.id,
    kind: attachment.kind,
    status: attachment.status,
    generationToken: attachment.generationToken,
    mimeType: attachment.mimeType,
    byteSize: attachment.byteSize,
    width: attachment.width,
    height: attachment.height,
    locationLabel: attachment.locationLabel,
  }
}

export function toMetadata(letter: LetterRow): LetterMetadata {
  return {
    letterId: letter.id,
    threadId: letter.threadId,
    parentLetterId: letter.parentLetterId,
    nextLetterId: letter.nextLetterId,
    status: letter.status,
    sealed: letter.sealed,
    deliveryMode: letter.deliveryMode,
    deliveryWindowStart: letter.deliveryWindowStart,
    deliveryWindowEnd: letter.deliveryWindowEnd,
    sentAt: letter.sentAt,
    deliveredAt: letter.deliveredAt,
    openedAt: letter.openedAt,
    repliedAt: letter.repliedAt,
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
  }
}

export function canReadMetadata(letter: LetterRow, userId: string): boolean {
  return letter.ownerId === userId && letter.deletedAt === null
}

export function canReadContent(letter: LetterRow, userId: string): boolean {
  if (!canReadMetadata(letter, userId)) return false
  if (letter.status === 'draft' || !letter.sealed) return true
  return letter.status === 'delivered' && letter.openedAt !== null
}

export function isReplyableParent(letter: LetterRow, userId: string): boolean {
  return canReadContent(letter, userId) && letter.status === 'delivered'
}

export async function listOwnedMetadata(
  env: AppEnv,
  userId: string,
  status: LetterStatus,
): Promise<LetterMetadata[]> {
  const result = await env.DB.prepare(
    `${LETTER_SELECT}
     WHERE owner_id = ? AND status = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC LIMIT ${LETTER_LIST_LIMIT}`,
  )
    .bind(userId, status)
    .all<LetterRowResult>()
  return result.results.map(toLetterRow).map(toMetadata)
}

export async function getDraftView(
  env: AppEnv,
  userId: string,
  letterId: string,
): Promise<DraftView | null> {
  const letter = await getLetter(env, letterId)
  if (!letter || !canReadMetadata(letter, userId) || letter.status !== 'draft') return null
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
}

export function assertBodyLength(body: string): void {
  if (body.length > MAX_LETTER_BODY_LENGTH) throw new HttpError(400, 'letter_body_too_long')
}

export function normalizeLocationLabel(label: string): string {
  const normalized = label.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new HttpError(400, 'location_label_required')
  if (normalized.length > MAX_LOCATION_LABEL_LENGTH)
    throw new HttpError(400, 'location_label_too_long')
  return normalized
}

export function resolveDeliveryWindow(
  now: number,
  mode: DeliveryMode,
  random: () => number = Math.random,
) {
  const range = deliveryWindowDays[mode]
  const day = 86_400_000
  const deliveryWindowStart = now + range.minDays * day
  const deliveryWindowEnd = now + range.maxDays * day
  const span = deliveryWindowEnd - deliveryWindowStart
  const unit = Math.min(0.999999999, Math.max(0, random()))
  return {
    deliveryWindowStart,
    deliveryWindowEnd,
    scheduledAt: deliveryWindowStart + Math.floor(unit * (span + 1)),
  }
}

export async function getThreadView(env: AppEnv, userId: string, threadId: string) {
  const thread = await env.DB.prepare(`SELECT id, owner_id, deleted_at FROM threads WHERE id = ?`)
    .bind(threadId)
    .first<{ id: string; owner_id: string; deleted_at: number | null }>()
  if (!thread || thread.owner_id !== userId || thread.deleted_at !== null) return null

  const letters = await env.DB.prepare(
    `${LETTER_SELECT}
     WHERE thread_id = ? ORDER BY sent_at ASC LIMIT ${THREAD_LETTER_LIMIT}`,
  )
    .bind(threadId)
    .all<LetterRowResult>()

  const segments: ThreadSegment[] = []
  for (const row of letters.results.map(toLetterRow)) {
    if (row.ownerId !== userId || row.sentAt === null) continue
    const readable = canReadContent(row, userId)
    let body: string | null = null
    let locationLabel: string | null = null
    if (readable) {
      const content = await getContent(env, row.id)
      const attachments = await listAttachments(env, row.id)
      body = content?.body ?? ''
      locationLabel =
        attachments.find(
          (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
        )?.locationLabel ?? null
    }
    segments.push({
      letterId: row.id,
      parentLetterId: row.parentLetterId,
      status: row.status,
      sealed: row.sealed,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      openedAt: row.openedAt,
      deleted: row.deletedAt !== null,
      body,
      locationLabel,
    })
  }
  return { threadId, letters: segments }
}

type UserRowResult = {
  id: string
  token_identifier: string
  email: string | null
  name: string | null
  picture_url: string | null
  created_at: number
  updated_at: number
}

type LetterRowResult = {
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

type LetterContentResult = {
  letter_id: string
  owner_id: string
  body: string
  created_at: number
  updated_at: number
}

type AttachmentResult = {
  id: string
  letter_id: string
  owner_id: string
  kind: 'photo' | 'location'
  status: AttachmentStatus
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

function toUserRow(row: UserRowResult): UserRow {
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

function toLetterRow(row: LetterRowResult): LetterRow {
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

function toContentRow(row: LetterContentResult): LetterContentRow {
  return {
    letterId: row.letter_id,
    ownerId: row.owner_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toAttachmentRow(row: AttachmentResult): AttachmentRow {
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
