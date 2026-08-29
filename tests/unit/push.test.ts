import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  PUSH_PERMISSION_COPY,
  notificationTapPath,
  readPushClientCapability,
  readPushVapidPublicKey,
  registerQuietServiceWorker,
  shouldReleaseBrowserPush,
} from '../../src/features/settings/model/push'

describe('push client model', () => {
  it('keeps permission copy free of letter content and taps into inbox', () => {
    expect(PUSH_PERMISSION_COPY).toContain('本文や写真は通知に出しません')
    expect(notificationTapPath()).toBe('/')
  })

  it('treats missing service worker, push manager, or VAPID public key as unsupported', () => {
    expect(
      readPushClientCapability({
        serviceWorker: undefined,
        pushManager: {},
        vapidPublicKey: 'key',
      }),
    ).toEqual({ kind: 'unsupported', reason: 'no_service_worker' })
    expect(
      readPushClientCapability({
        serviceWorker: {},
        pushManager: undefined,
        vapidPublicKey: 'key',
      }),
    ).toEqual({ kind: 'unsupported', reason: 'no_push_manager' })
    expect(
      readPushClientCapability({
        serviceWorker: {},
        pushManager: {},
        vapidPublicKey: null,
      }),
    ).toEqual({ kind: 'unsupported', reason: 'no_vapid_key' })
    expect(
      readPushClientCapability({
        serviceWorker: {},
        pushManager: {},
        vapidPublicKey: 'key',
      }),
    ).toEqual({ kind: 'unsupported', reason: 'no_notification' })
    expect(readPushVapidPublicKey({})).toBeNull()
    expect(shouldReleaseBrowserPush(false)).toBe(false)
    expect(shouldReleaseBrowserPush(true)).toBe(true)
  })

  it('opens inbox from the service worker notification click', () => {
    const source = readFileSync(resolve('public/sw.js'), 'utf8')
    expect(source).toContain("self.clients.openWindow('/')")
    expect(source).toContain('event.respondWith(fetch(event.request))')
    expect(source).not.toContain('caches')
    expect(source).not.toContain('letterId')
    expect(source).not.toContain('scheduledAt')
  })

  it('registers the service worker without asking for notification permission', () => {
    const register = vi.fn(async () => undefined)
    registerQuietServiceWorker({ register })
    expect(register).toHaveBeenCalledWith('/sw.js')
    registerQuietServiceWorker(undefined)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('keeps the web manifest on Re:Me mist tokens', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8')) as {
      background_color: string
      theme_color: string
      display: string
      icons: Array<{ src: string; sizes: string }>
    }

    expect(manifest.theme_color).toBe('#f4f8fc')
    expect(manifest.background_color).toBe('#f4f8fc')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      '/icons/icon-192.png',
      '/icons/icon-512.png',
    ])
  })
})
