import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { canReadLetterContent, canReadLetterMetadata, isReplyableParent } from './authorization'
import { MAX_LETTER_BODY_LENGTH } from './validators'

type LetterCtx = QueryCtx | MutationCtx

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
