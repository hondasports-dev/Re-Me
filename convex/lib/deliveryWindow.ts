import type { Infer } from 'convex/values'

import { deliveryModeValidator } from './validators'

export const MS_PER_DAY = 86_400_000

export const deliveryWindowDays = {
  few_days: { minDays: 3, maxDays: 7 },
  few_weeks: { minDays: 14, maxDays: 30 },
  few_months: { minDays: 60, maxDays: 180 },
  about_year: { minDays: 300, maxDays: 430 },
  surprise: { minDays: 30, maxDays: 365 },
} as const

export type DeliveryMode = Infer<typeof deliveryModeValidator>

export function resolveDeliveryWindow(
  now: number,
  mode: DeliveryMode,
  random: () => number = Math.random,
): {
  deliveryWindowStart: number
  deliveryWindowEnd: number
  scheduledAt: number
} {
  const range = deliveryWindowDays[mode]
  const deliveryWindowStart = now + range.minDays * MS_PER_DAY
  const deliveryWindowEnd = now + range.maxDays * MS_PER_DAY
  const span = deliveryWindowEnd - deliveryWindowStart
  const unit = Math.min(0.999999999, Math.max(0, random()))
  const scheduledAt = deliveryWindowStart + Math.floor(unit * (span + 1))

  return {
    deliveryWindowStart,
    deliveryWindowEnd,
    scheduledAt,
  }
}
