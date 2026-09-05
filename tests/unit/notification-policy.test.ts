import { describe, expect, it } from 'vitest'

import {
  ARRIVAL_NOTIFICATION_BODY,
  arrivalNotificationPayload,
  isPermanentlyInvalidPushEndpoint,
  nextNotificationAvailableAt,
  sanitizeNotificationErrorCode,
} from '../../worker/notification'

describe('notificationPolicy', () => {
  it('keeps the arrival payload free of letter content and exact schedule', () => {
    const payload = arrivalNotificationPayload()

    expect(payload).toContain(ARRIVAL_NOTIFICATION_BODY)
    expect(payload).not.toContain('scheduledAt')
    expect(payload).not.toContain('letterId')
    expect(payload).not.toMatch(/未来の自分/)
  })

  it('backs off failed notification jobs and sanitizes error codes', () => {
    const now = 1_700_000_000_000

    expect(nextNotificationAvailableAt(now, 1) - now).toBe(2 * 60_000)
    expect(nextNotificationAvailableAt(now, 6) - now).toBe(60 * 60_000)
    expect(sanitizeNotificationErrorCode('push_config_missing')).toBe('push_config_missing')
    expect(sanitizeNotificationErrorCode('ENOENT /tmp/secret')).toBe('push_failed')
  })

  it('treats gone push endpoints as permanently invalid', () => {
    expect(isPermanentlyInvalidPushEndpoint({ statusCode: 404 })).toBe(true)
    expect(isPermanentlyInvalidPushEndpoint({ statusCode: 410 })).toBe(true)
    expect(isPermanentlyInvalidPushEndpoint({ statusCode: 500 })).toBe(false)
    expect(isPermanentlyInvalidPushEndpoint(new Error('push_failed'))).toBe(false)
  })
})
