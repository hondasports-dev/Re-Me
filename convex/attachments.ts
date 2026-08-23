import { v } from 'convex/values'

import { query } from './_generated/server'
import { getCurrentUser } from './lib/auth'
import { canReadLetterContent } from './lib/authorization'
import { listLetterAttachments, loadVisibleLetter } from './lib/letters'
import { readableAttachmentValidator } from './lib/validators'

export const listReadableAttachments = query({
  args: { letterId: v.id('letters') },
  returns: v.union(v.array(readableAttachmentValidator), v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const letter = await loadVisibleLetter(ctx, user._id, args.letterId)

    if (!letter || !canReadLetterContent(letter, user._id)) {
      return null
    }

    const attachments = await listLetterAttachments(ctx, letter._id)

    return attachments
      .filter((attachment) => attachment.status !== 'deleting')
      .map((attachment) => ({
        attachmentId: attachment._id,
        kind: attachment.kind,
        status: attachment.status,
        locationLabel: attachment.locationLabel ?? null,
      }))
  },
})
