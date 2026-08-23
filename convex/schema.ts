import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  attachmentKindValidator,
  attachmentStatusValidator,
  deliveryModeValidator,
  deliveryStatusValidator,
  letterStatusValidator,
  notificationJobStatusValidator,
} from './lib/validators'

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    pictureUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),

  userSettings: defineTable({
    userId: v.id('users'),
    timezone: v.string(),
    pushEnabled: v.boolean(),
    emailNotificationEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  threads: defineTable({
    ownerId: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index('by_owner_and_updatedAt', ['ownerId', 'updatedAt']),

  letters: defineTable({
    threadId: v.id('threads'),
    ownerId: v.id('users'),
    parentLetterId: v.optional(v.id('letters')),
    nextLetterId: v.optional(v.id('letters')),
    status: letterStatusValidator,
    sealed: v.boolean(),
    deliveryMode: v.optional(deliveryModeValidator),
    deliveryWindowStart: v.optional(v.number()),
    deliveryWindowEnd: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index('by_owner_and_status', ['ownerId', 'status'])
    .index('by_owner_status_and_updatedAt', ['ownerId', 'status', 'updatedAt'])
    .index('by_thread_and_sentAt', ['threadId', 'sentAt'])
    .index('by_parentLetterId', ['parentLetterId']),

  letterContents: defineTable({
    letterId: v.id('letters'),
    ownerId: v.id('users'),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_letterId', ['letterId']),

  letterAttachments: defineTable({
    letterId: v.id('letters'),
    ownerId: v.id('users'),
    kind: attachmentKindValidator,
    status: attachmentStatusValidator,
    r2ObjectId: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    locationLabel: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_letterId', ['letterId']),

  letterDeliveries: defineTable({
    letterId: v.id('letters'),
    ownerId: v.id('users'),
    scheduledAt: v.number(),
    status: deliveryStatusValidator,
    attemptCount: v.number(),
    lastAttemptAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_letterId', ['letterId'])
    .index('by_scheduledAt', ['scheduledAt'])
    .index('by_status_and_scheduledAt', ['status', 'scheduledAt']),

  notificationJobs: defineTable({
    letterId: v.id('letters'),
    ownerId: v.id('users'),
    status: notificationJobStatusValidator,
    attemptCount: v.number(),
    generationToken: v.string(),
    availableAt: v.number(),
    lockedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_letterId', ['letterId'])
    .index('by_status_and_availableAt', ['status', 'availableAt']),

  pushSubscriptions: defineTable({
    ownerId: v.id('users'),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    disabledAt: v.optional(v.number()),
  })
    .index('by_ownerId', ['ownerId'])
    .index('by_endpoint', ['endpoint']),
})
