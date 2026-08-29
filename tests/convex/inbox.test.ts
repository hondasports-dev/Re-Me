import { afterEach, describe, expect, it } from 'vitest'

import { api } from '../../convex/_generated/api'
import { LETTER_LIST_LIMIT } from '../../convex/lib/validators'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }

describe('inbox letters', () => {
  afterEach(() => {
    delete process.env.E2E_FORCE_DELIVERY
  })

  it('lists only the owner delivered letters without body or scheduledAt', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const secretBody = '届いた本文は一覧に出さない'
    const traveling = await sendDraft(asAlice, {
      body: 'まだ旅の途中',
      sealed: false,
      deliveryMode: 'few_weeks',
    })
    const delivered = await sendDraft(asAlice, {
      body: secretBody,
      sealed: true,
      deliveryMode: 'few_days',
    })
    await withForceDelivery(async () => {
      await asAlice.mutation(api.letters.forceDeliverOwnLetter, { letterId: delivered.letterId })
    })
    const bobLetter = await sendDraft(asBob, {
      body: 'Bobの届いた手紙',
      sealed: false,
      deliveryMode: 'few_days',
    })
    await withForceDelivery(async () => {
      await asBob.mutation(api.letters.forceDeliverOwnLetter, { letterId: bobLetter.letterId })
    })

    const listed = await asAlice.query(api.letters.listDeliveredLetters, {})
    expect(listed.map((letter) => letter.letterId)).toEqual([delivered.letterId])
    expect(listed.every((letter) => letter.status === 'delivered')).toBe(true)
    expect(listed[0]).toMatchObject({
      sealed: true,
      openedAt: null,
      deliveredAt: expect.any(Number),
    })
    const serialized = JSON.stringify(listed)
    expect(serialized).not.toMatch(/scheduledAt/)
    expect(serialized).not.toContain(secretBody)
    expect(serialized).not.toContain('Bobの届いた手紙')
    expect(listed.find((letter) => letter.letterId === traveling.letterId)).toBeUndefined()

    const bobListed = await asBob.query(api.letters.listDeliveredLetters, {})
    expect(bobListed.map((letter) => letter.letterId)).toEqual([bobLetter.letterId])
    await expect(t.query(api.letters.listDeliveredLetters, {})).rejects.toThrow(
      /authentication required/,
    )
  })

  it('keeps sealed content hidden until openLetter and is safe to open twice', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const sent = await sendDraft(asAlice, {
      body: '開封する本文',
      sealed: true,
      deliveryMode: 'few_days',
    })
    await withForceDelivery(async () => {
      await asAlice.mutation(api.letters.forceDeliverOwnLetter, { letterId: sent.letterId })
    })
    await asBob.mutation(api.users.ensureCurrentUser, {})

    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: sent.letterId }),
    ).resolves.toBeNull()
    await expect(
      asAlice.query(api.attachments.listReadableAttachments, { letterId: sent.letterId }),
    ).resolves.toBeNull()
    await expect(
      asBob.mutation(api.letters.openLetter, { letterId: sent.letterId }),
    ).rejects.toThrow(/delivered letter not found/)

    const first = await asAlice.mutation(api.letters.openLetter, { letterId: sent.letterId })
    const second = await asAlice.mutation(api.letters.openLetter, { letterId: sent.letterId })
    const content = await asAlice.query(api.letters.getReadableContent, {
      letterId: sent.letterId,
    })
    const listed = await asAlice.query(api.letters.listDeliveredLetters, {})

    expect(second.openedAt).toBe(first.openedAt)
    expect(content).toEqual({ letterId: sent.letterId, body: '開封する本文' })
    expect(listed[0]?.openedAt).toBe(first.openedAt)
  })

  it('lets the owner read an unsealed delivered letter without opening it', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const sent = await sendDraft(asAlice, {
      body: '封をしない本文',
      sealed: false,
      deliveryMode: 'few_weeks',
    })
    await withForceDelivery(async () => {
      await asAlice.mutation(api.letters.forceDeliverOwnLetter, { letterId: sent.letterId })
    })

    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: sent.letterId }),
    ).resolves.toEqual({ letterId: sent.letterId, body: '封をしない本文' })
    const metadata = await asAlice.query(api.letters.getLetterMetadata, {
      letterId: sent.letterId,
    })
    expect(metadata).toMatchObject({
      status: 'delivered',
      sealed: false,
      openedAt: null,
    })
  })

  it('delivers the owner traveling letter even when scheduledAt is still in the future', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const sent = await sendDraft(asAlice, {
      body: 'まだ届く前',
      sealed: true,
      deliveryMode: 'about_year',
    })
    await asBob.mutation(api.users.ensureCurrentUser, {})

    await expect(
      asAlice.mutation(api.letters.forceDeliverOwnLetter, { letterId: sent.letterId }),
    ).rejects.toThrow(/force delivery is disabled/)
    await withForceDelivery(async () => {
      await expect(
        asBob.mutation(api.letters.forceDeliverOwnLetter, { letterId: sent.letterId }),
      ).rejects.toThrow(/letter not found/)
      const forced = await asAlice.mutation(api.letters.forceDeliverOwnLetter, {
        letterId: sent.letterId,
      })
      const again = await asAlice.mutation(api.letters.forceDeliverOwnLetter, {
        letterId: sent.letterId,
      })
      expect(again.deliveredAt).toBe(forced.deliveredAt)
    })

    const metadata = await asAlice.query(api.letters.getLetterMetadata, {
      letterId: sent.letterId,
    })
    const listed = await asAlice.query(api.letters.listDeliveredLetters, {})
    expect(metadata?.status).toBe('delivered')
    expect(listed.map((letter) => letter.letterId)).toEqual([sent.letterId])
    expect(JSON.stringify({ metadata, listed })).not.toContain('まだ届く前')
  })

  it('lists a live delivered letter even when many newer letters are deleted', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const live = await sendDraft(asAlice, {
      body: '残る届いた手紙',
      sealed: false,
      deliveryMode: 'few_weeks',
    })
    await withForceDelivery(async () => {
      await asAlice.mutation(api.letters.forceDeliverOwnLetter, { letterId: live.letterId })
    })

    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < LETTER_LIST_LIMIT; index += 1) {
        const threadId = await ctx.db.insert('threads', {
          ownerId: user.userId,
          createdAt: now,
          updatedAt: now + index,
        })
        await ctx.db.insert('letters', {
          threadId,
          ownerId: user.userId,
          status: 'delivered',
          sealed: true,
          deliveryMode: 'few_days',
          deliveryWindowStart: now,
          deliveryWindowEnd: now,
          sentAt: now,
          deliveredAt: now,
          createdAt: now,
          updatedAt: now + index + 1,
          deletedAt: now + index + 1,
        })
      }
    })

    const listed = await asAlice.query(api.letters.listDeliveredLetters, {})
    expect(listed.map((letter) => letter.letterId)).toContain(live.letterId)
    expect(listed).toHaveLength(1)
  })
})

async function withForceDelivery(run: () => Promise<void>): Promise<void> {
  const previous = process.env.E2E_FORCE_DELIVERY
  process.env.E2E_FORCE_DELIVERY = '1'
  try {
    await run()
  } finally {
    if (previous === undefined) {
      delete process.env.E2E_FORCE_DELIVERY
    } else {
      process.env.E2E_FORCE_DELIVERY = previous
    }
  }
}

async function sendDraft(
  asUser: ReturnType<ReturnType<typeof testConvex>['withIdentity']>,
  options: {
    body: string
    sealed: boolean
    deliveryMode: 'few_days' | 'few_weeks' | 'few_months' | 'about_year' | 'surprise'
  },
) {
  const created = await asUser.mutation(api.letters.createDraft, {})
  await asUser.mutation(api.letters.saveDraft, {
    letterId: created.letterId,
    body: options.body,
  })
  await asUser.mutation(api.letters.saveDraftSettings, {
    letterId: created.letterId,
    sealed: options.sealed,
    deliveryMode: options.deliveryMode,
  })
  await asUser.mutation(api.letters.sendLetter, { letterId: created.letterId })
  return created
}
