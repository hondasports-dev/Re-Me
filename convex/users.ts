import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  findUserByTokenIdentifier,
  getOrCreateUser,
  requireIdentity,
  toPublicUser,
} from './lib/auth'
import { publicUserValidator } from './lib/validators'

export const me = query({
  args: {},
  returns: v.union(publicUserValidator, v.null()),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const user = await findUserByTokenIdentifier(ctx, identity.tokenIdentifier)

    if (!user) {
      return null
    }

    return toPublicUser(user)
  },
})

export const ensureCurrentUser = mutation({
  args: {},
  returns: publicUserValidator,
  handler: async (ctx) => {
    const user = await getOrCreateUser(ctx)
    return toPublicUser(user)
  },
})
