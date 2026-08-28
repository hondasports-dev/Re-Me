export const ARRIVAL_NOTIFICATION_BODY = 'Re:Me — あなた宛ての手紙が届いています。'

export const notificationErrorCodes = ['push_failed', 'push_config_missing'] as const

export type NotificationErrorCode = (typeof notificationErrorCodes)[number]

const allowedErrorCodes = new Set<string>(notificationErrorCodes)

export function arrivalNotificationPayload(): string {
  return JSON.stringify({
    title: 'Re:Me',
    body: ARRIVAL_NOTIFICATION_BODY,
  })
}

export function nextNotificationAvailableAt(now: number, attemptCount: number): number {
  const cappedAttempt = Math.min(Math.max(attemptCount, 1), 6)
  const delayMinutes = Math.min(60, 2 ** cappedAttempt)
  return now + delayMinutes * 60_000
}

export function sanitizeNotificationErrorCode(code: string | undefined): NotificationErrorCode {
  if (code && allowedErrorCodes.has(code)) {
    return code as NotificationErrorCode
  }

  return 'push_failed'
}

export function isStaleNotificationLock(
  lockedAt: number | undefined,
  now: number,
  lockTimeoutMs: number,
): boolean {
  return lockedAt !== undefined && lockedAt <= now - lockTimeoutMs
}
