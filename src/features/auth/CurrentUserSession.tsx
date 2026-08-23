import { VisuallyHidden } from '@mantine/core'
import { useConvex, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { useAuthRuntime } from './AuthRuntimeProvider'
import { resolveConvexSessionState } from './convex-session'

const PROVISION_ATTEMPTS = 5

export function CurrentUserSession() {
  const { readiness } = useAuthRuntime()
  const convex = useConvex()
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser)
  const isAuthenticated = readiness.status === 'authenticated'
  const [provisionedUser, setProvisionedUser] = useState<{ userId: string } | null>(null)
  const [provisionError, setProvisionError] = useState<Error | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setProvisionedUser(null)
      setProvisionError(null)
      return
    }

    let cancelled = false

    void (async () => {
      let lastError: Error | null = null

      for (let attempt = 0; attempt < PROVISION_ATTEMPTS; attempt += 1) {
        try {
          await ensureCurrentUser({})
          const me = await convex.query(api.users.me, {})

          if (cancelled) {
            return
          }

          if (me) {
            setProvisionedUser({ userId: me.userId })
            setProvisionError(null)
            return
          }

          lastError = new Error('user_provision_failed')
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error('user_provision_failed')
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 250 * (attempt + 1))
        })
      }

      if (!cancelled) {
        setProvisionedUser(null)
        setProvisionError(lastError ?? new Error('user_provision_failed'))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [convex, ensureCurrentUser, isAuthenticated])

  const state = resolveConvexSessionState({
    isAuthenticated,
    provisionError,
    user: provisionedUser,
  })

  return (
    <VisuallyHidden>
      <span data-state={state} data-testid="convex-session">
        {state}
      </span>
    </VisuallyHidden>
  )
}
