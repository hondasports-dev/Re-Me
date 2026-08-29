import { afterEach, describe, expect, it } from 'vitest'

import { api } from '../../convex/_generated/api'
import { THREAD_LETTER_LIMIT } from '../../convex/lib/validators'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }

describe('thread letters', () => {
  afterEach(() => {
    delete process.env.E2E_FORCE_DELIVERY
  })

  it('lists a bounded one-path thread without sealed or deleted content', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    await asBob.mutation(api.users.ensureCurrentUser, {})

    const parent = await sendDraft(asAlice, {
      body: '一本目の本文',
      sealed: false,
      deliveryMode: 'few_days',
    })
    await withForceDelivery(async () => {
      await asAlice.mutation(api.letters.forceDeliverOwnLetter, { letterId: parent.letterId })
    })
    const reply = await asAlice.mutation(api.letters.createDraft, {
      parentLetterId: parent.letterId,
    })
    await asAlice.mutation(api.letters.saveDraft, {
      letterId: reply.letterId,
      body: '封をした返信',
    })
    await asAlice.mutation(api.letters.saveDraftSettings, {
      letterId: reply.letterId,
      sealed: true,
      deliveryMode: 'few_weeks',
    })
    await asAlice.mutation(api.letters.sendLetter, { letterId: reply.letterId })

    const deleted = await t.run(async (ctx) => {
      const now = Date.now()
      const letterId = await ctx.db.insert('letters', {
        threadId: parent.threadId,
        ownerId: user.userId,
        parentLetterId: reply.letterId,
        status: 'traveling',
        sealed: false,
        deliveryMode: 'few_days',
        sentAt: now + 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      })
      await ctx.db.insert('letterContents', {
        letterId,
        ownerId: user.userId,
        body: '削除した本文は出さない',
        createdAt: now,
        updatedAt: now,
      })
      return letterId
    })

    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < THREAD_LETTER_LIMIT; index += 1) {
        await ctx.db.insert('letters', {
          threadId: parent.threadId,
          ownerId: user.userId,
          status: 'traveling',
          sealed: false,
          deliveryMode: 'few_days',
          sentAt: now + 10_000 + index,
          createdAt: now,
          updatedAt: now,
        })
      }
    })

    const thread = await asAlice.query(api.threads.getThread, { threadId: parent.threadId })
    expect(thread).not.toBeNull()
    expect(thread?.letters.length).toBe(THREAD_LETTER_LIMIT)
    expect(thread?.letters[0]).toMatchObject({
      letterId: parent.letterId,
      body: '一本目の本文',
      deleted: false,
    })
    expect(thread?.letters[1]).toMatchObject({
      letterId: reply.letterId,
      parentLetterId: parent.letterId,
      body: null,
      deleted: false,
      sealed: true,
      status: 'traveling',
    })
    const deletedSegment = thread?.letters.find((letter) => letter.letterId === deleted)
    expect(deletedSegment).toMatchObject({
      deleted: true,
      body: null,
      locationLabel: null,
    })
    const serialized = JSON.stringify(thread)
    expect(serialized).not.toContain('scheduledAt')
    expect(serialized).not.toContain('封をした返信')
    expect(serialized).not.toContain('削除した本文は出さない')

    await expect(
      asBob.query(api.threads.getThread, { threadId: parent.threadId }),
    ).resolves.toBeNull()
    await expect(t.query(api.threads.getThread, { threadId: parent.threadId })).rejects.toThrow(
      /authentication required/,
    )
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
