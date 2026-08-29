import { v } from 'convex/values'

import { query } from './_generated/server'
import { getCurrentUser } from './lib/auth'
import { loadOwnedThreadLetters } from './lib/threads'
import { threadViewValidator } from './lib/validators'

export const getThread = query({
  args: { threadId: v.id('threads') },
  returns: v.union(threadViewValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    return await loadOwnedThreadLetters(ctx, user._id, args.threadId)
  },
})
