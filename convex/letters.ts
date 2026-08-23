import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { getCurrentUser, getOrCreateUser } from './lib/auth'
import { canReadLetterContent } from './lib/authorization'
import {
  assertBodyLength,
  getLetterContent,
  insertDraft,
  listLetterAttachments,
  loadOwnedDraft,
  loadVisibleLetter,
  toLetterMetadata,
} from './lib/letters'
import {
  createdDraftValidator,
  deliveryModeValidator,
  draftEditorValidator,
  LETTER_LIST_LIMIT,
  letterMetadataValidator,
  letterStatusValidator,
  readableContentValidator,
} from './lib/validators'

export const createDraft = mutation({
  args: {
    parentLetterId: v.optional(v.id('letters')),
  },
  returns: createdDraftValidator,
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx)
    return await insertDraft(ctx, user._id, args.parentLetterId)
  },
})

export const saveDraft = mutation({
  args: {
    letterId: v.id('letters'),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadOwnedDraft(ctx, user._id, args.letterId)
    assertBodyLength(args.body)

    const content = await getLetterContent(ctx, letter._id)

    if (!content) {
      throw new Error('draft letter not found')
    }

    const now = Date.now()
    await ctx.db.patch(content._id, { body: args.body, updatedAt: now })
    await ctx.db.patch(letter._id, { updatedAt: now })
    await ctx.db.patch(letter.threadId, { updatedAt: now })
    return null
  },
})

export const getDraft = query({
  args: { letterId: v.id('letters') },
  returns: v.union(draftEditorValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadVisibleLetter(ctx, user._id, args.letterId)

    if (!letter || letter.status !== 'draft') {
      return null
    }

    const content = await getLetterContent(ctx, letter._id)

    if (!content) {
      return null
    }

    const location = (await listLetterAttachments(ctx, letter._id)).find(
      (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
    )

    return {
      letterId: letter._id,
      threadId: letter.threadId,
      sealed: letter.sealed,
      deliveryMode: letter.deliveryMode ?? null,
      body: content.body,
      locationLabel: location?.locationLabel ?? null,
    }
  },
})

export const saveDraftSettings = mutation({
  args: {
    letterId: v.id('letters'),
    sealed: v.boolean(),
    deliveryMode: deliveryModeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadOwnedDraft(ctx, user._id, args.letterId)
    const now = Date.now()

    await ctx.db.patch(letter._id, {
      sealed: args.sealed,
      deliveryMode: args.deliveryMode,
      updatedAt: now,
    })
    await ctx.db.patch(letter.threadId, { updatedAt: now })
    return null
  },
})

export const getLetterMetadata = query({
  args: { letterId: v.id('letters') },
  returns: v.union(letterMetadataValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadVisibleLetter(ctx, user._id, args.letterId)

    if (!letter) {
      return null
    }

    return toLetterMetadata(letter)
  },
})

export const listMyLetterMetadata = query({
  args: { status: letterStatusValidator },
  returns: v.array(letterMetadataValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letters = await ctx.db
      .query('letters')
      .withIndex('by_owner_status_and_updatedAt', (q) =>
        q.eq('ownerId', user._id).eq('status', args.status),
      )
      .order('desc')
      .take(LETTER_LIST_LIMIT)

    return letters
      .filter((letter) => letter.deletedAt === undefined)
      .map((letter) => toLetterMetadata(letter))
  },
})

export const getReadableContent = query({
  args: { letterId: v.id('letters') },
  returns: v.union(readableContentValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadVisibleLetter(ctx, user._id, args.letterId)

    if (!letter || !canReadLetterContent(letter, user._id)) {
      return null
    }

    const content = await getLetterContent(ctx, letter._id)

    if (!content) {
      return null
    }

    return {
      letterId: letter._id,
      body: content.body,
    }
  },
})

export const openLetter = mutation({
  args: { letterId: v.id('letters') },
  returns: v.object({
    letterId: v.id('letters'),
    openedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await ctx.db.get(args.letterId)

    if (
      !letter ||
      letter.ownerId !== user._id ||
      letter.deletedAt !== undefined ||
      letter.status !== 'delivered'
    ) {
      throw new Error('delivered letter not found')
    }

    const openedAt = letter.openedAt ?? Date.now()

    if (letter.openedAt === undefined) {
      await ctx.db.patch(letter._id, {
        openedAt,
        updatedAt: openedAt,
      })
    }

    return {
      letterId: letter._id,
      openedAt,
    }
  },
})
