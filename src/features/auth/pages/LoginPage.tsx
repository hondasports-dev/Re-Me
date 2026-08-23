import { Button } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { useAuthSession } from '../AuthSessionProvider'

export function LoginPage() {
  const { initializeError, manager } = useAuthSession()
  const [searchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const routeError = useMemo(() => {
    const reason = searchParams.get('reason')

    if (reason === 'session_restore_failed' || initializeError === 'session_restore_failed') {
      return '認証の設定またはセッションを確認できませんでした。設定を確認して、もう一度お試しください。'
    }

    return null
  }, [initializeError, searchParams])

  const errorMessage = localError ?? routeError

  async function continueWithGoogle(): Promise<void> {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setLocalError(null)

    try {
      await manager.signInWithGoogle()
    } catch {
      setLocalError(
        'Google ログインを開始できませんでした。少し待ってから、もう一度お試しください。',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <p className="auth-panel__brand" aria-label="Re:Me 未来のあなたへ">
        Re:Me
      </p>
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
          void continueWithGoogle()
        }}
        variant="light"
      >
        Googleで続ける
      </Button>
    </section>
  )
}
