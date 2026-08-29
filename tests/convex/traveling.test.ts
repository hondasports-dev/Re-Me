import { describe, expect, it } from 'vitest'

import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { LETTER_LIST_LIMIT } from '../../convex/lib/validators'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }

describe('traveling letters', () => {
  it('lists only the owner traveling letters without scheduledAt or body', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const traveling = await sendDraft(asAlice, {
      body: '旅の本文は一覧に出さない',
      sealed: false,
      deliveryMode: 'few_weeks',
    })
    const sealed = await sendDraft(asAlice, {
      body: '封をした本文',
      sealed: true,
      deliveryMode: 'few_days',
    })
    const draft = await asAlice.mutation(api.letters.createDraft, {})
    await asAlice.mutation(api.letters.saveDraft, {
      letterId: draft.letterId,
      body: 'まだ下書き',
    })
    const bobLetter = await sendDraft(asBob, {
      body: 'Bobの手紙',
      sealed: false,
      deliveryMode: 'few_days',
    })

    const listed = await asAlice.query(api.letters.listTravelingLetters, {})
    expect(listed.map((letter) => letter.letterId).sort()).toEqual(
      [traveling.letterId, sealed.letterId].sort(),
    )
    expect(listed.every((letter) => letter.status === 'traveling')).toBe(true)
    const serialized = JSON.stringify(listed)
    expect(serialized).not.toMatch(/scheduledAt/)
    expect(serialized).not.toContain('旅の本文は一覧に出さない')
    expect(serialized).not.toContain('封をした本文')
    expect(listed.find((letter) => letter.letterId === traveling.letterId)).toMatchObject({
      sealed: false,
      deliveryMode: 'few_weeks',
      deliveryWindowStart: expect.any(Number),
      deliveryWindowEnd: expect.any(Number),
    })

    const bobListed = await asBob.query(api.letters.listTravelingLetters, {})
    expect(bobListed.map((letter) => letter.letterId)).toEqual([bobLetter.letterId])
    await expect(t.query(api.letters.listTravelingLetters, {})).rejects.toThrow(
      /authentication required/,
    )
  })

  it('returns unsealed content after re-checking authorization and hides sealed content', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const open = await sendDraft(asAlice, {
      body: '読み返せる本文',
      sealed: false,
      deliveryMode: 'few_weeks',
    })
    const sealed = await sendDraft(asAlice, {
      body: '秘密の本文',
      sealed: true,
      deliveryMode: 'few_days',
    })
    await asBob.mutation(api.users.ensureCurrentUser, {})

    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: open.letterId }),
    ).resolves.toEqual({ letterId: open.letterId, body: '読み返せる本文' })
    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: sealed.letterId }),
    ).resolves.toBeNull()
    await expect(
      asAlice.query(api.attachments.listReadableAttachments, { letterId: sealed.letterId }),
    ).resolves.toBeNull()
    await expect(
      asBob.query(api.letters.getReadableContent, { letterId: open.letterId }),
    ).resolves.toBeNull()
    await expect(asBob.query(api.letters.listTravelingLetters, {})).resolves.toEqual([])
  })

  it('deletes a traveling letter from the list and cancels pending delivery', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const sent = await sendDraft(asAlice, {
      body: '削除する手紙',
      sealed: false,
      deliveryMode: 'few_days',
    })
    await asBob.mutation(api.users.ensureCurrentUser, {})

    const delivery = await readDelivery(t, sent.letterId)
    expect(delivery?.status).toBe('pending')

    await expect(t.mutation(api.letters.deleteLetter, { letterId: sent.letterId })).rejects.toThrow(
      /authentication required/,
    )
    await expect(
      asBob.mutation(api.letters.deleteLetter, { letterId: sent.letterId }),
    ).rejects.toThrow(/letter not found/)

    await asAlice.mutation(api.letters.deleteLetter, { letterId: sent.letterId })
    await asAlice.mutation(api.letters.deleteLetter, { letterId: sent.letterId })

    const listed = await asAlice.query(api.letters.listTravelingLetters, {})
    expect(listed.map((letter) => letter.letterId)).not.toContain(sent.letterId)
    await expect(
      asAlice.query(api.letters.getLetterMetadata, { letterId: sent.letterId }),
    ).resolves.toBeNull()
    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: sent.letterId }),
    ).resolves.toBeNull()

    const canceled = await readDelivery(t, sent.letterId)
    expect(canceled?.status).toBe('canceled')

    const due = await t.query(internal.delivery.listDueDeliveries, {
      now: (canceled?.scheduledAt ?? 0) + 1,
      limit: 10,
    })
    expect(due.find((item) => item.letterId === sent.letterId)).toBeUndefined()
  })

  it('lists a live traveling letter even when many newer letters are deleted', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const live = await sendDraft(asAlice, {
      body: '残る手紙',
      sealed: false,
      deliveryMode: 'few_weeks',
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
          status: 'traveling',
          sealed: true,
          deliveryMode: 'few_days',
          deliveryWindowStart: now,
          deliveryWindowEnd: now,
          sentAt: now,
          createdAt: now,
          updatedAt: now + index + 1,
          deletedAt: now + index + 1,
        })
      }
    })

    const listed = await asAlice.query(api.letters.listTravelingLetters, {})
    expect(listed.map((letter) => letter.letterId)).toContain(live.letterId)
    expect(listed).toHaveLength(1)
  })

  it('rejects deleting a draft and keeps sent letters immutable', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const draft = await asAlice.mutation(api.letters.createDraft, {})
    const sent = await sendDraft(asAlice, {
      body: '編集できない',
      sealed: false,
      deliveryMode: 'few_days',
    })

    await expect(
      asAlice.mutation(api.letters.deleteLetter, { letterId: draft.letterId }),
    ).rejects.toThrow(/letter is not traveling/)
    await expect(
      asAlice.mutation(api.letters.saveDraft, {
        letterId: sent.letterId,
        body: '書き換える',
      }),
    ).rejects.toThrow(/letter is not a draft/)
    await expect(
      asAlice.mutation(api.letters.saveDraftSettings, {
        letterId: sent.letterId,
        sealed: true,
        deliveryMode: 'about_year',
      }),
    ).rejects.toThrow(/letter is not a draft/)
  })
})

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

async function readDelivery(t: ReturnType<typeof testConvex>, letterId: Id<'letters'>) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query('letterDeliveries')
      .withIndex('by_letterId', (q) => q.eq('letterId', letterId))
      .unique()
  })
}
