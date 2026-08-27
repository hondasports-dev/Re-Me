import { describe, expect, it } from 'vitest'

import { MS_PER_DAY, resolveDeliveryWindow } from '../../convex/lib/deliveryWindow'

describe('resolveDeliveryWindow', () => {
  it('keeps few_days inside 3 to 7 days and can land on either bound', () => {
    const now = 1_700_000_000_000
    const min = resolveDeliveryWindow(now, 'few_days', () => 0)
    const max = resolveDeliveryWindow(now, 'few_days', () => 0.999999999)

    expect(min.deliveryWindowStart).toBe(now + 3 * MS_PER_DAY)
    expect(min.deliveryWindowEnd).toBe(now + 7 * MS_PER_DAY)
    expect(min.scheduledAt).toBe(min.deliveryWindowStart)
    expect(max.scheduledAt).toBe(max.deliveryWindowEnd)
  })

  it('uses the documented ranges for each delivery mode', () => {
    const now = 0
    const cases = [
      ['few_weeks', 14, 30],
      ['few_months', 60, 180],
      ['about_year', 300, 430],
      ['surprise', 30, 365],
    ] as const

    for (const [mode, minDays, maxDays] of cases) {
      const window = resolveDeliveryWindow(now, mode, () => 0.5)
      expect(window.deliveryWindowStart).toBe(minDays * MS_PER_DAY)
      expect(window.deliveryWindowEnd).toBe(maxDays * MS_PER_DAY)
      expect(window.scheduledAt).toBeGreaterThan(window.deliveryWindowStart)
      expect(window.scheduledAt).toBeLessThan(window.deliveryWindowEnd)
    }
  })
})
