import { v } from 'convex/values'

import { query } from './_generated/server'

export const get = query({
  args: {},
  returns: v.object({
    ok: v.literal(true),
    service: v.literal('convex'),
  }),
  handler: async () => {
    return {
      ok: true as const,
      service: 'convex' as const,
    }
  },
})
