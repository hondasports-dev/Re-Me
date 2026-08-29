import type { Doc, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { canReadLetterContent } from './authorization'
import { getLetterContent, listLetterAttachments } from './letters'
import { THREAD_LETTER_LIMIT } from './validators'

export type ThreadSegment = {
  letterId: Id<'letters'>
  parentLetterId: Id<'letters'> | null
  status: Doc<'letters'>['status']
  sealed: boolean
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  deleted: boolean
  body: string | null
  locationLabel: string | null
}

export async function loadOwnedThreadLetters(
  ctx: QueryCtx,
  userId: Id<'users'>,
  threadId: Id<'threads'>,
): Promise<{ threadId: Id<'threads'>; letters: ThreadSegment[] } | null> {
  const thread = await ctx.db.get(threadId)

  if (!thread || thread.ownerId !== userId || thread.deletedAt !== undefined) {
    return null
  }

  const letters = await ctx.db
    .query('letters')
    .withIndex('by_thread_and_sentAt', (q) => q.eq('threadId', threadId))
    .order('asc')
    .take(THREAD_LETTER_LIMIT)

  const segments: ThreadSegment[] = []

  for (const letter of letters) {
    if (letter.ownerId !== userId || letter.sentAt === undefined) {
      continue
    }

    segments.push(await toThreadSegment(ctx, letter, userId))
  }

  return { threadId, letters: segments }
}

async function toThreadSegment(
  ctx: QueryCtx,
  letter: Doc<'letters'>,
  userId: Id<'users'>,
): Promise<ThreadSegment> {
  const deleted = letter.deletedAt !== undefined
  const readable = !deleted && canReadLetterContent(letter, userId)
  let body: string | null = null
  let locationLabel: string | null = null

  if (readable) {
    const content = await getLetterContent(ctx, letter._id)
    const attachments = await listLetterAttachments(ctx, letter._id)
    const location = attachments.find(
      (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
    )
    body = content?.body ?? ''
    locationLabel = location?.locationLabel ?? null
  }

  return {
    letterId: letter._id,
    parentLetterId: letter.parentLetterId ?? null,
    status: letter.status,
    sealed: letter.sealed,
    sentAt: letter.sentAt ?? null,
    deliveredAt: letter.deliveredAt ?? null,
    openedAt: letter.openedAt ?? null,
    deleted,
    body,
    locationLabel,
  }
}
