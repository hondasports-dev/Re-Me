import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { canReadLetterContent, canReadLetterMetadata, isReplyableParent } from './authorization'
import { resolveDeliveryWindow } from './deliveryWindow'
import { MAX_LETTER_BODY_LENGTH, MAX_LOCATION_LABEL_LENGTH } from './validators'

type LetterCtx = QueryCtx | MutationCtx

export type SentLetter = {
  letterId: Id<'letters'>
  threadId: Id<'threads'>
  status: 'traveling'
  sealed: boolean
  deliveryMode: NonNullable<Doc<'letters'>['deliveryMode']>
  deliveryWindowStart: number
  deliveryWindowEnd: number
  sentAt: number
}

export type LetterMetadata = {
  letterId: Id<'letters'>
  threadId: Id<'threads'>
  parentLetterId: Id<'letters'> | null
  nextLetterId: Id<'letters'> | null
  status: Doc<'letters'>['status']
  sealed: boolean
  deliveryMode: NonNullable<Doc<'letters'>['deliveryMode']> | null
  deliveryWindowStart: number | null
  deliveryWindowEnd: number | null
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  repliedAt: number | null
  createdAt: number
  updatedAt: number
}

export function toLetterMetadata(letter: Doc<'letters'>): LetterMetadata {
  return {
    letterId: letter._id,
    threadId: letter.threadId,
    parentLetterId: letter.parentLetterId ?? null,
    nextLetterId: letter.nextLetterId ?? null,
    status: letter.status,
    sealed: letter.sealed,
    deliveryMode: letter.deliveryMode ?? null,
    deliveryWindowStart: letter.deliveryWindowStart ?? null,
    deliveryWindowEnd: letter.deliveryWindowEnd ?? null,
    sentAt: letter.sentAt ?? null,
    deliveredAt: letter.deliveredAt ?? null,
    openedAt: letter.openedAt ?? null,
    repliedAt: letter.repliedAt ?? null,
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
  }
}

export function assertBodyLength(body: string): void {
  if (body.length > MAX_LETTER_BODY_LENGTH) {
    throw new Error('letter body is too long')
  }
}

export async function getLetterContent(
  ctx: LetterCtx,
  letterId: Id<'letters'>,
): Promise<Doc<'letterContents'> | null> {
  return await ctx.db
    .query('letterContents')
    .withIndex('by_letterId', (q) => q.eq('letterId', letterId))
    .unique()
}

export async function listLetterAttachments(ctx: LetterCtx, letterId: Id<'letters'>) {
  return await ctx.db
    .query('letterAttachments')
    .withIndex('by_letterId', (q) => q.eq('letterId', letterId))
    .take(20)
}

export async function loadVisibleLetter(
  ctx: LetterCtx,
  userId: Id<'users'>,
  letterId: Id<'letters'>,
): Promise<Doc<'letters'> | null> {
  const letter = await ctx.db.get(letterId)

  if (!letter || !canReadLetterMetadata(letter, userId)) {
    return null
  }

  return letter
}

export function normalizeLocationLabel(label: string): string {
  const normalized = label.trim().replace(/\s+/g, ' ')

  if (normalized.length === 0) {
    throw new Error('location label is required')
  }

  if (normalized.length > MAX_LOCATION_LABEL_LENGTH) {
    throw new Error('location label is too long')
  }

  return normalized
}

export async function upsertDraftLocation(
  ctx: MutationCtx,
  letter: Doc<'letters'>,
  locationLabel: string,
): Promise<string> {
  const normalized = normalizeLocationLabel(locationLabel)
  const existing = (await listLetterAttachments(ctx, letter._id)).find(
    (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
  )
  const now = Date.now()

  if (existing) {
    await ctx.db.patch(existing._id, { locationLabel: normalized, status: 'ready' })
  } else {
    await ctx.db.insert('letterAttachments', {
      letterId: letter._id,
      ownerId: letter.ownerId,
      kind: 'location',
      status: 'ready',
      locationLabel: normalized,
      createdAt: now,
    })
  }

  await ctx.db.patch(letter._id, { updatedAt: now })
  await ctx.db.patch(letter.threadId, { updatedAt: now })
  return normalized
}

export async function clearDraftLocation(ctx: MutationCtx, letter: Doc<'letters'>): Promise<void> {
  const existing = (await listLetterAttachments(ctx, letter._id)).find(
    (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
  )

  if (existing) {
    await ctx.db.delete(existing._id)
  }

  const now = Date.now()
  await ctx.db.patch(letter._id, { updatedAt: now })
  await ctx.db.patch(letter.threadId, { updatedAt: now })
}

export async function loadOwnedDraft(
  ctx: MutationCtx,
  userId: Id<'users'>,
  letterId: Id<'letters'>,
): Promise<Doc<'letters'>> {
  const letter = await ctx.db.get(letterId)

  if (!letter || !canReadLetterMetadata(letter, userId)) {
    throw new Error('draft letter not found')
  }

  if (letter.status !== 'draft') {
    throw new Error('letter is not a draft')
  }

  return letter
}

export async function insertDraft(
  ctx: MutationCtx,
  ownerId: Id<'users'>,
  parentLetterId?: Id<'letters'>,
): Promise<{ letterId: Id<'letters'>; threadId: Id<'threads'> }> {
  const now = Date.now()
  let threadId: Id<'threads'>

  if (parentLetterId) {
    const parent = await ctx.db.get(parentLetterId)

    if (!parent || !isReplyableParent(parent, ownerId)) {
      throw new Error('parent letter is not replyable')
    }

    threadId = parent.threadId
    const letterId = await ctx.db.insert('letters', {
      threadId,
      ownerId,
      parentLetterId,
      status: 'draft',
      sealed: true,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('letterContents', {
      letterId,
      ownerId,
      body: '',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(parent._id, {
      nextLetterId: letterId,
      repliedAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(threadId, { updatedAt: now })
    return { letterId, threadId }
  }

  threadId = await ctx.db.insert('threads', {
    ownerId,
    createdAt: now,
    updatedAt: now,
  })
  const letterId = await ctx.db.insert('letters', {
    threadId,
    ownerId,
    status: 'draft',
    sealed: true,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('letterContents', {
    letterId,
    ownerId,
    body: '',
    createdAt: now,
    updatedAt: now,
  })
  return { letterId, threadId }
}

export function canReadContentOrNull(
  letter: Doc<'letters'> | null,
  userId: Id<'users'>,
): letter is Doc<'letters'> {
  return letter !== null && canReadLetterContent(letter, userId)
}

export async function sendOwnedLetter(
  ctx: MutationCtx,
  userId: Id<'users'>,
  letterId: Id<'letters'>,
): Promise<SentLetter> {
  const letter = await ctx.db.get(letterId)

  if (!letter || !canReadLetterMetadata(letter, userId)) {
    throw new Error('letter not found')
  }

  if (letter.status === 'traveling') {
    return toSentLetter(letter)
  }

  if (letter.status !== 'draft') {
    throw new Error('letter is not a draft')
  }

  const content = await getLetterContent(ctx, letter._id)

  if (!content || content.body.trim().length === 0) {
    throw new Error('letter body is empty')
  }

  assertBodyLength(content.body)

  if (!letter.deliveryMode) {
    throw new Error('delivery mode is required')
  }

  const attachments = await listLetterAttachments(ctx, letter._id)

  if (attachments.some((attachment) => attachment.status !== 'ready')) {
    throw new Error('attachments are not ready')
  }

  const now = Date.now()
  await claimParentOnSend(ctx, letter, userId, now)
  const schedule = resolveDeliveryWindow(now, letter.deliveryMode)

  await ctx.db.insert('letterDeliveries', {
    letterId: letter._id,
    ownerId: letter.ownerId,
    scheduledAt: schedule.scheduledAt,
    status: 'pending',
    attemptCount: 0,
    createdAt: now,
  })
  await ctx.db.patch(letter._id, {
    status: 'traveling',
    deliveryWindowStart: schedule.deliveryWindowStart,
    deliveryWindowEnd: schedule.deliveryWindowEnd,
    sentAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(letter.threadId, { updatedAt: now })

  return {
    letterId: letter._id,
    threadId: letter.threadId,
    status: 'traveling',
    sealed: letter.sealed,
    deliveryMode: letter.deliveryMode,
    deliveryWindowStart: schedule.deliveryWindowStart,
    deliveryWindowEnd: schedule.deliveryWindowEnd,
    sentAt: now,
  }
}

function toSentLetter(letter: Doc<'letters'>): SentLetter {
  if (
    letter.status !== 'traveling' ||
    !letter.deliveryMode ||
    letter.deliveryWindowStart === undefined ||
    letter.deliveryWindowEnd === undefined ||
    letter.sentAt === undefined
  ) {
    throw new Error('letter is not sendable')
  }

  return {
    letterId: letter._id,
    threadId: letter.threadId,
    status: 'traveling',
    sealed: letter.sealed,
    deliveryMode: letter.deliveryMode,
    deliveryWindowStart: letter.deliveryWindowStart,
    deliveryWindowEnd: letter.deliveryWindowEnd,
    sentAt: letter.sentAt,
  }
}

async function claimParentOnSend(
  ctx: MutationCtx,
  letter: Doc<'letters'>,
  userId: Id<'users'>,
  now: number,
): Promise<void> {
  if (!letter.parentLetterId) {
    return
  }

  const parent = await ctx.db.get(letter.parentLetterId)

  if (!parent || !canReadLetterMetadata(parent, userId)) {
    throw new Error('parent letter is not replyable')
  }

  if (parent.nextLetterId !== undefined && parent.nextLetterId !== letter._id) {
    throw new Error('parent letter is already claimed')
  }

  if (parent.nextLetterId === letter._id) {
    return
  }

  if (parent.status !== 'delivered' || parent.openedAt === undefined) {
    throw new Error('parent letter is not replyable')
  }

  await ctx.db.patch(parent._id, {
    nextLetterId: letter._id,
    repliedAt: now,
    updatedAt: now,
  })
}
