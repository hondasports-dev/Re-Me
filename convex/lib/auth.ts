import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { publicUserValidator } from './validators'

type AuthCtx = QueryCtx | MutationCtx

export type PublicUser = {
  userId: Doc<'users'>['_id']
  email?: string
  name?: string
  pictureUrl?: string
}

export const publicUserReturns = publicUserValidator

export function toPublicUser(user: Doc<'users'>): PublicUser {
  return {
    userId: user._id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
  }
}

export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity()

  if (!identity) {
    throw new Error('authentication required')
  }

  return identity
}

export async function findUsersByTokenIdentifier(
  ctx: AuthCtx,
  tokenIdentifier: string,
): Promise<Doc<'users'>[]> {
  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .take(2)
}

function canonicalUser(users: Doc<'users'>[]): Doc<'users'> | null {
  if (users.length === 0) {
    return null
  }

  return [...users].sort((left, right) => left._creationTime - right._creationTime)[0] ?? null
}

export async function findUserByTokenIdentifier(
  ctx: AuthCtx,
  tokenIdentifier: string,
): Promise<Doc<'users'> | null> {
  return canonicalUser(await findUsersByTokenIdentifier(ctx, tokenIdentifier))
}

export async function getCurrentUser(ctx: AuthCtx): Promise<Doc<'users'>> {
  const identity = await requireIdentity(ctx)
  const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier)

  if (!user) {
    throw new Error('user not found')
  }

  return user
}

export async function getOrCreateUser(ctx: MutationCtx): Promise<Doc<'users'>> {
  const identity = await requireIdentity(ctx)
  const existing = await findUsersByTokenIdentifier(ctx, identity.tokenIdentifier)
  const canonical = canonicalUser(existing)

  if (canonical) {
    await deleteDuplicateUsers(ctx, existing, canonical._id)
    return canonical
  }

  const now = Date.now()
  await ctx.db.insert('users', {
    tokenIdentifier: identity.tokenIdentifier,
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
    pictureUrl: identity.pictureUrl ?? undefined,
    createdAt: now,
    updatedAt: now,
  })

  const matches = await findUsersByTokenIdentifier(ctx, identity.tokenIdentifier)
  const user = canonicalUser(matches)

  if (!user) {
    throw new Error('user not found')
  }

  await deleteDuplicateUsers(ctx, matches, user._id)
  return user
}

async function deleteDuplicateUsers(
  ctx: MutationCtx,
  users: Doc<'users'>[],
  canonicalId: Doc<'users'>['_id'],
): Promise<void> {
  for (const user of users) {
    if (user._id !== canonicalId) {
      await ctx.db.delete(user._id)
    }
  }
}
