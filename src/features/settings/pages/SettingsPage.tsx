import { Button } from '@mantine/core'
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import {
  PUSH_PERMISSION_COPY,
  readPushClientCapability,
  readPushVapidPublicKey,
  urlBase64ToUint8Array,
} from '../model/push'

export function SettingsPage() {
  const upsertMine = useMutation(api.pushSubscriptions.upsertMine)
  const disableMine = useMutation(api.pushSubscriptions.disableMine)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>(() =>
    typeof Notification === 'undefined' ? 'unknown' : Notification.permission,
  )
  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null)
  const capability = readPushClientCapability()

  useEffect(() => {
    if (capability.kind !== 'supported') {
      setLocalEnabled(false)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js')
        const subscription = await registration?.pushManager.getSubscription()
        if (!cancelled) {
          setLocalEnabled(Boolean(subscription))
        }
      } catch {
        if (!cancelled) {
          setLocalEnabled(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [capability.kind])

  async function enablePush(): Promise<void> {
    if (busy || capability.kind !== 'supported') {
      return
    }

    setBusy(true)
    setError(null)

    try {
      await navigator.serviceWorker.register('/sw.js')
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)

      if (nextPermission !== 'granted') {
        setLocalEnabled(false)
        return
      }

      const vapid = readPushVapidPublicKey()
      if (!vapid) {
        throw new Error('push_config_missing')
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })
      const json = subscription.toJSON()
      const endpoint = json.endpoint
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth

      if (!endpoint || !p256dh || !auth) {
        throw new Error('push_subscription_incomplete')
      }

      await upsertMine({
        endpoint,
        p256dh,
        auth,
        userAgent: navigator.userAgent.slice(0, 256),
      })
      setLocalEnabled(true)
    } catch {
      setError('通知の準備ができませんでした。あとでもう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  async function disablePush(): Promise<void> {
    if (busy) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await disableMine({ endpoint: subscription.endpoint })
        await subscription.unsubscribe()
      }
      setLocalEnabled(false)
    } catch {
      setError('通知の停止に失敗しました。あとでもう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  if (localEnabled === null) {
    return (
      <StatusScreen
        description="通知の設定をひらいています。"
        title="設定"
        tone="content"
        variant="loading"
      />
    )
  }

  const unsupportedCopy =
    capability.kind === 'unsupported'
      ? 'このブラウザでは通知を使えません。手紙の作成・受信・開封はそのまま使えます。'
      : permission === 'denied'
        ? '通知はブラウザで許可されていません。手紙の作成・受信・開封はそのまま使えます。'
        : null

  return (
    <section className="settings-page">
      <p className="settings-page__eyebrow">静かな到着</p>
      <h1>設定</h1>
      <p className="settings-page__copy">{PUSH_PERMISSION_COPY}</p>
      {unsupportedCopy ? <p className="settings-page__copy">{unsupportedCopy}</p> : null}
      {error ? (
        <p className="settings-page__alert" role="alert">
          {error}
        </p>
      ) : null}
      {capability.kind === 'supported' && permission !== 'denied' ? (
        localEnabled ? (
          <Button disabled={busy} onClick={() => void disablePush()} type="button" variant="subtle">
            到着通知を止める
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void enablePush()} type="button">
            到着通知を受け取る
          </Button>
        )
      ) : null}
    </section>
  )
}
