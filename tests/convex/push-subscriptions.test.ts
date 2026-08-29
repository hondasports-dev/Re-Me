import { describe, expect, it } from 'vitest'

import { api, internal } from '../../convex/_generated/api'
import { testConvex } from './harness'

const alice = { name: 'Alice', subject: 'alice' }
const bob = { name: 'Bob', subject: 'bob' }

const aliceEndpoint = 'https://push.example/alice'
const subscriptionKeys = {
  auth: 'auth-token',
  p256dh: 'p256dh-token',
}

describe('pushSubscriptions', () => {
  it('upserts and disables only the owner subscription', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    await asAlice.mutation(api.users.ensureCurrentUser, {})
    await asBob.mutation(api.users.ensureCurrentUser, {})

    const saved = await asAlice.mutation(api.pushSubscriptions.upsertMine, {
      endpoint: aliceEndpoint,
      ...subscriptionKeys,
    })
    expect(saved).toEqual({ enabled: true })
    expect(JSON.stringify(saved)).not.toContain(aliceEndpoint)
    expect(JSON.stringify(saved)).not.toContain('auth-token')

    await expect(
      asBob.mutation(api.pushSubscriptions.upsertMine, {
        endpoint: aliceEndpoint,
        ...subscriptionKeys,
      }),
    ).rejects.toThrowError('push subscription is not available')

    const bobStatus = await asBob.query(api.pushSubscriptions.getMyPushStatus, {})
    expect(bobStatus).toEqual({ enabled: false })

    const aliceDisabled = await asAlice.mutation(api.pushSubscriptions.disableMine, {
      endpoint: aliceEndpoint,
    })
    expect(aliceDisabled).toEqual({ enabled: false })
    expect(await asAlice.query(api.pushSubscriptions.getMyPushStatus, {})).toEqual({
      enabled: false,
    })

    const bobDisable = await asBob.mutation(api.pushSubscriptions.disableMine, {
      endpoint: aliceEndpoint,
    })
    expect(bobDisable).toEqual({ enabled: false })
    expect(JSON.stringify(bobDisable)).not.toContain(aliceEndpoint)
  })

  it('does not let another user disable an active owner subscription', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const asBob = t.withIdentity(bob)
    await asAlice.mutation(api.users.ensureCurrentUser, {})
    await asBob.mutation(api.users.ensureCurrentUser, {})

    await asAlice.mutation(api.pushSubscriptions.upsertMine, {
      endpoint: aliceEndpoint,
      ...subscriptionKeys,
    })

    expect(
      await asBob.mutation(api.pushSubscriptions.disableMine, { endpoint: aliceEndpoint }),
    ).toEqual({ enabled: false })
    expect(await asAlice.query(api.pushSubscriptions.getMyPushStatus, {})).toEqual({
      enabled: true,
    })
  })

  it('re-enables a previously disabled own endpoint and keeps internal disable for gone endpoints', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    const user = await asAlice.mutation(api.users.ensureCurrentUser, {})

    await asAlice.mutation(api.pushSubscriptions.upsertMine, {
      endpoint: aliceEndpoint,
      ...subscriptionKeys,
    })
    await asAlice.mutation(api.pushSubscriptions.disableMine, { endpoint: aliceEndpoint })
    await asAlice.mutation(api.pushSubscriptions.upsertMine, {
      endpoint: aliceEndpoint,
      auth: 'rotated-auth',
      p256dh: 'rotated-p256dh',
    })

    expect(await asAlice.query(api.pushSubscriptions.getMyPushStatus, {})).toEqual({
      enabled: true,
    })

    const gone = await t.mutation(internal.notifications.disablePushSubscription, {
      ownerId: user.userId,
      endpoint: aliceEndpoint,
    })
    expect(gone).toEqual({ disabled: true })
    expect(await asAlice.query(api.pushSubscriptions.getMyPushStatus, {})).toEqual({
      enabled: false,
    })
  })

  it('rejects non-https endpoints', async () => {
    const t = testConvex()
    const asAlice = t.withIdentity(alice)
    await asAlice.mutation(api.users.ensureCurrentUser, {})

    await expect(
      asAlice.mutation(api.pushSubscriptions.upsertMine, {
        endpoint: 'http://push.example/insecure',
        ...subscriptionKeys,
      }),
    ).rejects.toThrowError('push subscription is invalid')
  })

  it('rejects unauthenticated subscription access', async () => {
    const t = testConvex()

    await expect(t.query(api.pushSubscriptions.getMyPushStatus, {})).rejects.toThrowError()
    await expect(
      t.mutation(api.pushSubscriptions.upsertMine, {
        endpoint: aliceEndpoint,
        ...subscriptionKeys,
      }),
    ).rejects.toThrowError()
  })
})
