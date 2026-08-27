import { describe, expect, it } from 'vitest'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { MS_PER_DAY } from '../../convex/lib/deliveryWindow'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }

describe('sendLetter', () => {
  it('rejects unauthenticated send and another user sending the draft', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const created = await prepareSendableDraft(asAlice)
    await asBob.mutation(api.users.ensureCurrentUser, {})

    await expect(
      t.mutation(api.letters.sendLetter, { letterId: created.letterId }),
    ).rejects.toThrow(/authentication required/)
    await expect(
      asBob.mutation(api.letters.sendLetter, { letterId: created.letterId }),
    ).rejects.toThrow(/letter not found/)
  })

  it('sends a sealed and an unsealed letter without exposing scheduledAt', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const sealed = await prepareSendableDraft(asAlice, {
      body: '封をした手紙',
      sealed: true,
      deliveryMode: 'few_days',
    })
    const open = await prepareSendableDraft(asAlice, {
      body: '封をしない手紙',
      sealed: false,
      deliveryMode: 'few_weeks',
    })

    const sealedResult = await asAlice.mutation(api.letters.sendLetter, {
      letterId: sealed.letterId,
    })
    const openResult = await asAlice.mutation(api.letters.sendLetter, {
      letterId: open.letterId,
    })

    expect(sealedResult).toMatchObject({
      letterId: sealed.letterId,
      status: 'traveling',
      sealed: true,
      deliveryMode: 'few_days',
    })
    expect(openResult).toMatchObject({
      letterId: open.letterId,
      status: 'traveling',
      sealed: false,
      deliveryMode: 'few_weeks',
    })
    expect(sealedResult).not.toHaveProperty('scheduledAt')
    expect(openResult).not.toHaveProperty('scheduledAt')

    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: sealed.letterId }),
    ).resolves.toBeNull()
    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: open.letterId }),
    ).resolves.toEqual({ letterId: open.letterId, body: '封をしない手紙' })

    const sealedDelivery = await readDelivery(t, sealed.letterId)
    const openDelivery = await readDelivery(t, open.letterId)
    expect(sealedDelivery?.status).toBe('pending')
    expect(sealedDelivery?.scheduledAt).toBeGreaterThanOrEqual(sealedResult.deliveryWindowStart)
    expect(sealedDelivery?.scheduledAt).toBeLessThanOrEqual(sealedResult.deliveryWindowEnd)
    expect(openDelivery?.scheduledAt).toBeGreaterThanOrEqual(openResult.deliveryWindowStart)
    expect(openDelivery?.scheduledAt).toBeLessThanOrEqual(openResult.deliveryWindowEnd)
    expect(sealedResult.deliveryWindowEnd - sealedResult.deliveryWindowStart).toBe(4 * MS_PER_DAY)
    expect(openResult.deliveryWindowEnd - openResult.deliveryWindowStart).toBe(16 * MS_PER_DAY)

    const traveling = await asAlice.query(api.letters.listMyLetterMetadata, {
      status: 'traveling',
    })
    expect(traveling.map((letter) => letter.letterId).sort()).toEqual(
      [sealed.letterId, open.letterId].sort(),
    )
    expect(JSON.stringify(traveling)).not.toMatch(/scheduledAt/)
  })

  it('is idempotent on retry and does not create a second delivery', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await prepareSendableDraft(asAlice)

    const first = await asAlice.mutation(api.letters.sendLetter, { letterId: created.letterId })
    const second = await asAlice.mutation(api.letters.sendLetter, { letterId: created.letterId })

    expect(second).toEqual(first)
    const deliveries = await t.run(async (ctx) => {
      return await ctx.db
        .query('letterDeliveries')
        .withIndex('by_letterId', (q) => q.eq('letterId', created.letterId))
        .take(5)
    })
    expect(deliveries).toHaveLength(1)
  })

  it('rejects empty body, missing delivery mode, and unfinished attachments', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const empty = await asAlice.mutation(api.letters.createDraft, {})
    await asAlice.mutation(api.letters.saveDraftSettings, {
      letterId: empty.letterId,
      sealed: true,
      deliveryMode: 'few_days',
    })
    await expect(
      asAlice.mutation(api.letters.sendLetter, { letterId: empty.letterId }),
    ).rejects.toThrow(/letter body is empty/)

    const noMode = await asAlice.mutation(api.letters.createDraft, {})
    await asAlice.mutation(api.letters.saveDraft, {
      letterId: noMode.letterId,
      body: '本文はある',
    })
    await expect(
      asAlice.mutation(api.letters.sendLetter, { letterId: noMode.letterId }),
    ).rejects.toThrow(/delivery mode is required/)

    const pending = await prepareSendableDraft(asAlice)
    await asAlice.mutation(api.attachments.createAttachmentIntent, {
      letterId: pending.letterId,
      mimeType: 'image/jpeg',
      byteSize: 23,
      width: 1200,
      height: 800,
    })
    await expect(
      asAlice.mutation(api.letters.sendLetter, { letterId: pending.letterId }),
    ).rejects.toThrow(/attachments are not ready/)

    const deleting = await prepareSendableDraft(asAlice)
    const readyPhoto = await asAlice.mutation(api.attachments.createAttachmentIntent, {
      letterId: deleting.letterId,
      mimeType: 'image/jpeg',
      byteSize: 23,
      width: 1200,
      height: 800,
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(readyPhoto.attachmentId, { status: 'deleting' })
    })
    await expect(
      asAlice.mutation(api.letters.sendLetter, { letterId: deleting.letterId }),
    ).rejects.toThrow(/attachments are not ready/)
  })

  it('keeps sent letters immutable and claims a reply parent once', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const created = await prepareSendableDraft(asAlice, { body: '送信後は変えない' })
    await asAlice.mutation(api.letters.sendLetter, { letterId: created.letterId })

    await expect(
      asAlice.mutation(api.letters.saveDraft, {
        letterId: created.letterId,
        body: '書き換え',
      }),
    ).rejects.toThrow(/letter is not a draft/)
    await expect(
      asAlice.mutation(api.letters.saveDraftSettings, {
        letterId: created.letterId,
        sealed: false,
        deliveryMode: 'surprise',
      }),
    ).rejects.toThrow(/letter is not a draft/)
    await expect(
      asAlice.query(api.letters.getDraft, { letterId: created.letterId }),
    ).resolves.toBeNull()

    const parent = await seedDeliveredOpenedLetter(t, user.userId)
    const firstReply = await t.run(async (ctx) => {
      const now = Date.now()
      const letterId = await ctx.db.insert('letters', {
        threadId: parent.threadId,
        ownerId: user.userId,
        parentLetterId: parent.letterId,
        status: 'draft',
        sealed: true,
        deliveryMode: 'few_days',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('letterContents', {
        letterId,
        ownerId: user.userId,
        body: '一本目の返信',
        createdAt: now,
        updatedAt: now,
      })
      return letterId
    })
    const secondReply = await t.run(async (ctx) => {
      const now = Date.now()
      const letterId = await ctx.db.insert('letters', {
        threadId: parent.threadId,
        ownerId: user.userId,
        parentLetterId: parent.letterId,
        status: 'draft',
        sealed: true,
        deliveryMode: 'few_days',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('letterContents', {
        letterId,
        ownerId: user.userId,
        body: '二本目は送れない',
        createdAt: now,
        updatedAt: now,
      })
      return letterId
    })

    const sentReply = await asAlice.mutation(api.letters.sendLetter, { letterId: firstReply })
    expect(sentReply.status).toBe('traveling')
    await expect(
      asAlice.mutation(api.letters.sendLetter, { letterId: secondReply }),
    ).rejects.toThrow(/parent letter is already claimed/)

    const claimed = await t.run(async (ctx) => await ctx.db.get(parent.letterId))
    expect(claimed?.nextLetterId).toBe(firstReply)
    expect(claimed?.repliedAt).toEqual(expect.any(Number))
  })
})

async function prepareSendableDraft(
  asUser: ReturnType<ReturnType<typeof testConvex>['withIdentity']>,
  options?: {
    body?: string
    sealed?: boolean
    deliveryMode?: 'few_days' | 'few_weeks' | 'few_months' | 'about_year' | 'surprise'
  },
) {
  const created = await asUser.mutation(api.letters.createDraft, {})
  await asUser.mutation(api.letters.saveDraft, {
    letterId: created.letterId,
    body: options?.body ?? '未来の自分へ',
  })
  await asUser.mutation(api.letters.saveDraftSettings, {
    letterId: created.letterId,
    sealed: options?.sealed ?? true,
    deliveryMode: options?.deliveryMode ?? 'few_days',
  })
  return created
}

async function readDelivery(t: ReturnType<typeof testConvex>, letterId: Id<'letters'>) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query('letterDeliveries')
      .withIndex('by_letterId', (q) => q.eq('letterId', letterId))
      .unique()
  })
}

async function seedDeliveredOpenedLetter(t: ReturnType<typeof testConvex>, ownerId: Id<'users'>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const threadId = await ctx.db.insert('threads', {
      ownerId,
      createdAt: now,
      updatedAt: now,
    })
    const letterId = await ctx.db.insert('letters', {
      threadId,
      ownerId,
      status: 'delivered',
      sealed: true,
      deliveryMode: 'few_days',
      sentAt: now,
      deliveredAt: now,
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('letterContents', {
      letterId,
      ownerId,
      body: '開封済みの親',
      createdAt: now,
      updatedAt: now,
    })
    return { letterId, threadId }
  })
}
