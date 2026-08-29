export const NOTIFICATION_TAP_PATH = '/'
export const ARRIVAL_NOTIFICATION_TITLE = 'Re:Me'
export const PUSH_PERMISSION_COPY =
  '届いた手紙を忘れないよう、静かな通知だけ送ります。本文や写真は通知に出しません。'

export type PushClientCapability =
  | {
      kind: 'unsupported'
      reason: 'no_service_worker' | 'no_push_manager' | 'no_vapid_key' | 'no_notification'
    }
  | { kind: 'supported'; permission: NotificationPermission }

export function readPushVapidPublicKey(
  env: { VITE_WEB_PUSH_VAPID_PUBLIC_KEY?: string } = {
    VITE_WEB_PUSH_VAPID_PUBLIC_KEY: import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY,
  },
): string | null {
  const value = env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function readPushClientCapability(
  globals: {
    notification?: { permission: NotificationPermission }
    pushManager?: unknown
    serviceWorker?: unknown
    vapidPublicKey?: string | null
  } = {
    notification: typeof Notification === 'undefined' ? undefined : Notification,
    pushManager: typeof PushManager === 'undefined' ? undefined : PushManager,
    serviceWorker: typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
    vapidPublicKey: readPushVapidPublicKey(),
  },
): PushClientCapability {
  if (!globals.serviceWorker) {
    return { kind: 'unsupported', reason: 'no_service_worker' }
  }

  if (!globals.pushManager) {
    return { kind: 'unsupported', reason: 'no_push_manager' }
  }

  if (!globals.vapidPublicKey) {
    return { kind: 'unsupported', reason: 'no_vapid_key' }
  }

  if (!globals.notification) {
    return { kind: 'unsupported', reason: 'no_notification' }
  }

  return {
    kind: 'supported',
    permission: globals.notification.permission,
  }
}

export function notificationTapPath(): string {
  return NOTIFICATION_TAP_PATH
}

export function shouldReleaseBrowserPush(owned: boolean): boolean {
  return owned
}

export function registerQuietServiceWorker(
  serviceWorker:
    | { register: (scriptURL: string) => Promise<unknown> }
    | undefined = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker,
): void {
  if (!serviceWorker) {
    return
  }

  void serviceWorker.register('/sw.js').catch(() => undefined)
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replaceAll('-', '+').replaceAll('_', '/')
  const raw = atob(base64)
  const output: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(raw.length))

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}
