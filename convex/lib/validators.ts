import { v } from 'convex/values'

export const MAX_LETTER_BODY_LENGTH = 20_000
export const MAX_LOCATION_LABEL_LENGTH = 80
export const LETTER_LIST_LIMIT = 50
export const DUE_DELIVERY_LIMIT = 100

export const letterStatusValidator = v.union(
  v.literal('draft'),
  v.literal('traveling'),
  v.literal('delivered'),
)

export const deliveryModeValidator = v.union(
  v.literal('few_days'),
  v.literal('few_weeks'),
  v.literal('few_months'),
  v.literal('about_year'),
  v.literal('surprise'),
)

export const attachmentKindValidator = v.union(v.literal('photo'), v.literal('location'))

export const attachmentStatusValidator = v.union(
  v.literal('pending'),
  v.literal('ready'),
  v.literal('deleting'),
)

export const deliveryStatusValidator = v.union(
  v.literal('pending'),
  v.literal('consumed'),
  v.literal('canceled'),
)

export const notificationJobStatusValidator = v.union(
  v.literal('pending'),
  v.literal('processing'),
  v.literal('sent'),
  v.literal('failed'),
)

export const publicUserValidator = v.object({
  userId: v.id('users'),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  pictureUrl: v.optional(v.string()),
})

export const letterMetadataValidator = v.object({
  letterId: v.id('letters'),
  threadId: v.id('threads'),
  parentLetterId: v.union(v.id('letters'), v.null()),
  nextLetterId: v.union(v.id('letters'), v.null()),
  status: letterStatusValidator,
  sealed: v.boolean(),
  deliveryMode: v.union(deliveryModeValidator, v.null()),
  deliveryWindowStart: v.union(v.number(), v.null()),
  deliveryWindowEnd: v.union(v.number(), v.null()),
  sentAt: v.union(v.number(), v.null()),
  deliveredAt: v.union(v.number(), v.null()),
  openedAt: v.union(v.number(), v.null()),
  repliedAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const readableContentValidator = v.object({
  letterId: v.id('letters'),
  body: v.string(),
})

export const readableAttachmentValidator = v.object({
  attachmentId: v.id('letterAttachments'),
  kind: attachmentKindValidator,
  status: attachmentStatusValidator,
  generationToken: v.union(v.string(), v.null()),
  mimeType: v.union(v.string(), v.null()),
  byteSize: v.union(v.number(), v.null()),
  width: v.union(v.number(), v.null()),
  height: v.union(v.number(), v.null()),
  locationLabel: v.union(v.string(), v.null()),
})

export const attachmentUploadIntentValidator = v.object({
  attachmentId: v.id('letterAttachments'),
  generationToken: v.string(),
  uploadUrl: v.string(),
  expiresAt: v.number(),
})

export const attachmentDownloadCapabilityValidator = v.object({
  url: v.string(),
  expiresAt: v.number(),
})

export const createdDraftValidator = v.object({
  letterId: v.id('letters'),
  threadId: v.id('threads'),
})

export const sentLetterValidator = v.object({
  letterId: v.id('letters'),
  threadId: v.id('threads'),
  status: v.literal('traveling'),
  sealed: v.boolean(),
  deliveryMode: deliveryModeValidator,
  deliveryWindowStart: v.number(),
  deliveryWindowEnd: v.number(),
  sentAt: v.number(),
})

export const draftEditorValidator = v.object({
  letterId: v.id('letters'),
  threadId: v.id('threads'),
  sealed: v.boolean(),
  deliveryMode: v.union(deliveryModeValidator, v.null()),
  body: v.string(),
  locationLabel: v.union(v.string(), v.null()),
  attachmentsReady: v.boolean(),
})
