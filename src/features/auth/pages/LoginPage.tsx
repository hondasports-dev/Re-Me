import { Button } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { useAuthRuntime } from '../AuthRuntimeProvider'
import { AUTH0_DATABASE_CONNECTION, shouldStartE2eDatabaseLogin } from '../e2e-database-login'

export function LoginPage() {
  const { loginWithRedirect, readiness } = useAuthRuntime()
  const [searchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const e2eStarted = useRef(false)
  const submittingRef = useRef(false)

  const routeError = useMemo(() => {
    if (searchParams.get('reason') === 'session_restore_failed' || readiness.status === 'error') {
      return '認証の設定またはセッションを確認できませんでした。設定を確認して、もう一度お試しください。'
    }

    return null
  }, [readiness.status, searchParams])

  const errorMessage = localError ?? routeError

  async function startLogin(connection = 'google-oauth2'): Promise<void> {
    if (submittingRef.current) {
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setLocalError(null)

    try {
      await loginWithRedirect({ connection })
    } catch {
      submittingRef.current = false
      setIsSubmitting(false)
      setLocalError(
        connection === 'google-oauth2'
          ? 'Google ログインを開始できませんでした。少し待ってから、もう一度お試しください。'
          : 'ログインを開始できませんでした。少し待ってから、もう一度お試しください。',
      )
    }
  }

  useEffect(() => {
    if (e2eStarted.current) {
      return
    }

    if (!shouldStartE2eDatabaseLogin(import.meta.env.VITE_ALLOW_E2E_DB_LOGIN, searchParams)) {
      return
    }

    e2eStarted.current = true
    void startLogin(AUTH0_DATABASE_CONNECTION)
  }, [loginWithRedirect, searchParams])

  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <p className="auth-panel__brand">Re:Me</p>
      <h1 id="login-title">未来のあなたへ</h1>
      <p className="auth-panel__copy">今のあなたから、まだ見ぬ未来のあなたへ。</p>

      {errorMessage ? (
        <p className="auth-panel__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button
        className="auth-panel__action"
        disabled={isSubmitting}
        loading={isSubmitting}
        onClick={() => {
          void startLogin()
        }}
        variant="light"
      >
        Googleで続ける
      </Button>
    </section>
  )
}
