import { describe, expect, it } from 'vitest'

import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }

describe('Convex authorization harness', () => {
  it('keeps the public health query available without authentication', async () => {
    const t = testConvex()

    await expect(t.query(api.health.get, {})).resolves.toEqual({
      ok: true,
      service: 'convex',
    })
  })

  it('rejects unauthenticated access to user data functions', async () => {
    const t = testConvex()
    const created = await t.withIdentity(alice).mutation(api.letters.createDraft, {})

    await expect(t.query(api.users.me, {})).rejects.toThrow(/authentication required/)
    await expect(t.mutation(api.users.ensureCurrentUser, {})).rejects.toThrow(
      /authentication required/,
    )
    await expect(t.mutation(api.letters.createDraft, {})).rejects.toThrow(/authentication required/)
    await expect(
      t.query(api.letters.getLetterMetadata, { letterId: created.letterId }),
    ).rejects.toThrow(/authentication required/)
    await expect(
      t.query(api.letters.getReadableContent, { letterId: created.letterId }),
    ).rejects.toThrow(/authentication required/)
    await expect(
      t.mutation(api.letters.saveDraft, { letterId: created.letterId, body: 'nope' }),
    ).rejects.toThrow(/authentication required/)
    await expect(t.query(api.letters.listMyLetterMetadata, { status: 'draft' })).rejects.toThrow(
      /authentication required/,
    )
    await expect(
      t.mutation(api.letters.openLetter, { letterId: created.letterId }),
    ).rejects.toThrow(/authentication required/)
    await expect(
      t.query(api.attachments.listReadableAttachments, { letterId: created.letterId }),
    ).rejects.toThrow(/authentication required/)
  })

  it('provisions the users document and returns it from an authenticated query', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)

    await expect(asAlice.query(api.users.me, {})).resolves.toBeNull()

    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const me = await asAlice.query(api.users.me, {})

    expect(me).toEqual(user)
    expect(user.name).toBe('Alice')
  })

  it('creates a draft atomically for the authenticated user', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const created = await asAlice.mutation(api.letters.createDraft, {})
    const metadata = await asAlice.query(api.letters.getLetterMetadata, {
      letterId: created.letterId,
    })
    const content = await asAlice.query(api.letters.getReadableContent, {
      letterId: created.letterId,
    })

    expect(metadata).toMatchObject({
      letterId: created.letterId,
      threadId: created.threadId,
      status: 'draft',
    })
    expect(content).toEqual({ letterId: created.letterId, body: '' })
    expect(metadata && 'scheduledAt' in metadata).toBe(false)
  })

  it('does not let user B read or change user A letters', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    await asBob.mutation(api.users.ensureCurrentUser, {})
    const created = await asAlice.mutation(api.letters.createDraft, {})
    await asAlice.mutation(api.letters.saveDraft, {
      letterId: created.letterId,
      body: 'Alice only',
    })

    await expect(
      asBob.query(api.letters.getLetterMetadata, { letterId: created.letterId }),
    ).resolves.toBeNull()
    await expect(
      asBob.query(api.letters.getReadableContent, { letterId: created.letterId }),
    ).resolves.toBeNull()
    await expect(
      asBob.query(api.attachments.listReadableAttachments, { letterId: created.letterId }),
    ).resolves.toBeNull()
    await expect(
      asBob.mutation(api.letters.saveDraft, {
        letterId: created.letterId,
        body: 'hijack',
      }),
    ).rejects.toThrow(/draft letter not found/)

    const delivered = await seedSentLetter(
      t,
      (await asAlice.mutation(api.users.ensureCurrentUser, {})).userId,
      {
        status: 'delivered',
        sealed: true,
        opened: true,
        body: 'not for Bob',
      },
    )
    await expect(
      asBob.mutation(api.letters.openLetter, { letterId: delivered.letterId }),
    ).rejects.toThrow(/delivered letter not found/)
    await expect(
      asBob.query(api.letters.listMyLetterMetadata, { status: 'delivered' }),
    ).resolves.toEqual([])
    await expect(
      asBob.mutation(api.letters.createDraft, { parentLetterId: delivered.letterId }),
    ).rejects.toThrow(/parent letter is not replyable/)
  })

  it('hides sealed traveling and delivered-unopened content from the owner', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const traveling = await seedSentLetter(t, user.userId, {
      status: 'traveling',
      sealed: true,
      opened: false,
      body: 'secret traveling',
    })
    const unopened = await seedSentLetter(t, user.userId, {
      status: 'delivered',
      sealed: true,
      opened: false,
      body: 'secret unopened',
    })

    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: traveling.letterId }),
    ).resolves.toBeNull()
    await expect(
      asAlice.query(api.attachments.listReadableAttachments, { letterId: traveling.letterId }),
    ).resolves.toBeNull()
    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: unopened.letterId }),
    ).resolves.toBeNull()
    await expect(
      asAlice.query(api.attachments.listReadableAttachments, { letterId: unopened.letterId }),
    ).resolves.toBeNull()

    const travelingMetadata = await asAlice.query(api.letters.getLetterMetadata, {
      letterId: traveling.letterId,
    })
    expect(travelingMetadata?.status).toBe('traveling')
    expect(travelingMetadata && 'scheduledAt' in travelingMetadata).toBe(false)
  })

  it('returns sealed content only after openLetter', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const delivered = await seedSentLetter(t, user.userId, {
      status: 'delivered',
      sealed: true,
      opened: false,
      body: 'open me',
    })

    await expect(
      asAlice.query(api.letters.getReadableContent, { letterId: delivered.letterId }),
    ).resolves.toBeNull()

    const opened = await asAlice.mutation(api.letters.openLetter, {
      letterId: delivered.letterId,
    })
    const content = await asAlice.query(api.letters.getReadableContent, {
      letterId: delivered.letterId,
    })
    const attachments = await asAlice.query(api.attachments.listReadableAttachments, {
      letterId: delivered.letterId,
    })

    expect(opened.openedAt).toBeTypeOf('number')
    expect(content).toEqual({ letterId: delivered.letterId, body: 'open me' })
    expect(attachments).toEqual([
      expect.objectContaining({
        kind: 'location',
        locationLabel: '京都駅',
      }),
    ])
  })

  it('rejects saveDraft after the letter leaves draft', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const traveling = await seedSentLetter(t, user.userId, {
      status: 'traveling',
      sealed: false,
      opened: false,
      body: 'already sent',
    })

    await expect(
      asAlice.mutation(api.letters.saveDraft, {
        letterId: traveling.letterId,
        body: 'rewrite',
      }),
    ).rejects.toThrow(/letter is not a draft/)
  })

  it('keeps exact scheduledAt off public results', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const sent = await seedSentLetter(t, user.userId, {
      status: 'traveling',
      sealed: false,
      opened: false,
      body: 'window only',
    })
    const metadata = await asAlice.query(api.letters.getLetterMetadata, {
      letterId: sent.letterId,
    })
    const listed = await asAlice.query(api.letters.listMyLetterMetadata, {
      status: 'traveling',
    })
    const serialized = JSON.stringify({ metadata, listed })

    expect(metadata?.deliveryWindowStart).toEqual(expect.any(Number))
    expect(serialized).not.toContain('scheduledAt')
    expect(serialized).not.toContain(String(sent.scheduledAt))
  })

  it('does not expose internal delivery functions on the public API', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const sent = await seedSentLetter(t, user.userId, {
      status: 'traveling',
      sealed: false,
      opened: false,
      body: 'due',
    })

    expect('delivery' in api).toBe(false)

    await t.run(async (ctx) => {
      await ctx.db.insert('letterDeliveries', {
        letterId: sent.letterId,
        ownerId: user.userId,
        scheduledAt: sent.scheduledAt - 1_000,
        status: 'consumed',
        attemptCount: 1,
        createdAt: Date.now(),
      })
    })

    const due = await t.query(internal.delivery.listDueDeliveries, {
      now: sent.scheduledAt + 1,
      limit: 10,
    })

    expect(due).toEqual([
      expect.objectContaining({
        letterId: sent.letterId,
        scheduledAt: sent.scheduledAt,
      }),
    ])
  })

  it('rejects a second reply to the same parent letter', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})
    const parent = await seedSentLetter(t, user.userId, {
      status: 'delivered',
      sealed: true,
      opened: true,
      body: 'parent',
    })

    const first = await asAlice.mutation(api.letters.createDraft, {
      parentLetterId: parent.letterId,
    })
    expect(first.threadId).toBe(parent.threadId)

    await expect(
      asAlice.mutation(api.letters.createDraft, { parentLetterId: parent.letterId }),
    ).rejects.toThrow(/parent letter is not replyable/)
  })

  it('lists letters with an owner/status index and a bounded take', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    await asAlice.mutation(api.letters.createDraft, {})
    await asAlice.mutation(api.letters.createDraft, {})

    const drafts = await asAlice.query(api.letters.listMyLetterMetadata, { status: 'draft' })

    expect(drafts.length).toBe(2)
    expect(drafts.every((letter) => letter.status === 'draft')).toBe(true)
  })
})

async function seedSentLetter(
  t: ReturnType<typeof testConvex>,
  ownerId: Id<'users'>,
  options: {
    status: 'traveling' | 'delivered'
    sealed: boolean
    opened: boolean
    body: string
  },
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const scheduledAt = now + 86_400_000
    const threadId = await ctx.db.insert('threads', {
      ownerId,
      createdAt: now,
      updatedAt: now,
    })
    const letterId = await ctx.db.insert('letters', {
      threadId,
      ownerId,
      status: options.status,
      sealed: options.sealed,
      deliveryMode: 'few_days',
      deliveryWindowStart: now + 3 * 86_400_000,
      deliveryWindowEnd: now + 7 * 86_400_000,
      sentAt: now,
      deliveredAt: options.status === 'delivered' ? now : undefined,
      openedAt: options.opened ? now : undefined,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('letterContents', {
      letterId,
      ownerId,
      body: options.body,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('letterDeliveries', {
      letterId,
      ownerId,
      scheduledAt,
      status: 'pending',
      attemptCount: 0,
      createdAt: now,
    })
    await ctx.db.insert('letterAttachments', {
      letterId,
      ownerId,
      kind: 'location',
      status: 'ready',
      locationLabel: '京都駅',
      createdAt: now,
    })

    return { letterId, threadId, scheduledAt }
  })
}
