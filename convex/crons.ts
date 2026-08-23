import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'reconcile R2 photo attachments',
  { minutes: 15 },
  internal.attachments.reconcileAttachmentState,
  {},
)

export default crons
