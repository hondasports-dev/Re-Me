export const MAX_LETTER_BODY_LENGTH = 20_000
export const MAX_LOCATION_LABEL_LENGTH = 80
export const LETTER_LIST_LIMIT = 50
export const THREAD_LETTER_LIMIT = 50
export const MAX_PHOTOS_PER_LETTER = 3
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const UPLOAD_CAPABILITY_SECONDS = 5 * 60
export const DOWNLOAD_CAPABILITY_SECONDS = 60
export const DELIVERY_SWEEP_LIMIT = 100
export const NOTIFICATION_CLAIM_LIMIT = 50
export const NOTIFICATION_LOCK_TIMEOUT_MS = 5 * 60 * 1000
export const LOCK_TIMEOUT_MS = NOTIFICATION_LOCK_TIMEOUT_MS
export const RECONCILIATION_LIMIT = 20
export const MS_PER_DAY = 86_400_000

export const deliveryWindowDays = {
  few_days: { minDays: 3, maxDays: 7 },
  few_weeks: { minDays: 14, maxDays: 30 },
  few_months: { minDays: 60, maxDays: 180 },
  about_year: { minDays: 300, maxDays: 430 },
  surprise: { minDays: 30, maxDays: 365 },
} as const

export type DeliveryMode = keyof typeof deliveryWindowDays

export function resolveDeliveryWindow(
  now: number,
  mode: DeliveryMode,
  random: () => number = Math.random,
): { deliveryWindowStart: number; deliveryWindowEnd: number; scheduledAt: number } {
  const range = deliveryWindowDays[mode]
  const deliveryWindowStart = now + range.minDays * MS_PER_DAY
  const deliveryWindowEnd = now + range.maxDays * MS_PER_DAY
  const span = deliveryWindowEnd - deliveryWindowStart
  const unit = Math.min(0.999999999, Math.max(0, random()))
  return {
    deliveryWindowStart,
    deliveryWindowEnd,
    scheduledAt: deliveryWindowStart + Math.floor(unit * (span + 1)),
  }
}

export const letterStatuses = ['draft', 'traveling', 'delivered'] as const
export type LetterStatus = (typeof letterStatuses)[number]

export const attachmentKinds = ['photo', 'location'] as const
export type AttachmentKind = (typeof attachmentKinds)[number]

export const attachmentStatuses = ['pending', 'ready', 'deleting'] as const
export type AttachmentStatus = (typeof attachmentStatuses)[number]
