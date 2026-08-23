import { Button } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { useAuthSession } from '../AuthSessionProvider'

export function AuthCallbackPage() {
  const { manager, session, status } = useAuthSession()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [uiStatus, setUiStatus] = useState<'error' | 'processing'>('processing')
  const started = useRef(false)

  useEffect(() => {
    if (status === 'authenticated' && session) {
      void navigate('/', { replace: true })
    }
  }, [navigate, session, status])

  useEffect(() => {
    if (started.current) {
      return
    }

    started.current = true
    const code = searchParams.get('code') ?? ''
    const providerError = searchParams.has('error') || searchParams.has('error_description')

    // Scrub one-time codes and provider error details from both the address bar and router state.
    void navigate('/auth/callback', { replace: true })

    if (providerError || !code) {
      setUiStatus('error')
      return
    }

    void manager
      .completeOAuthCallback(code)
      .then(() => {
        void navigate('/', { replace: true })
      })
      .catch(() => {
        if (manager.session) {
          void navigate('/', { replace: true })
          return
        }

        setUiStatus('error')
      })
  }, [manager, navigate, searchParams])

  return (
    <section className="auth-panel" aria-labelledby="callback-title" aria-live="polite">
      <p className="auth-panel__brand" aria-label="Re:Me 未来のあなたへ">
        Re:Me
      </p>

      {uiStatus === 'processing' ? (
        <>
          <h1 id="callback-title">扉をひらいています</h1>
          <p className="auth-panel__copy">未来へ続く場所を、静かに準備しています。</p>
          <span className="auth-panel__spinner" aria-hidden="true" />
        </>
      ) : (
        <>
          <h1 id="callback-title" tabIndex={-1}>
            ログインを完了できませんでした
          </h1>
          <p className="auth-panel__error" role="alert">
            認証がキャンセルされたか、時間切れになりました。もう一度お試しください。
          </p>
          <Button
            className="auth-panel__action"
            onClick={() => {
              void navigate('/login', { replace: true })
            }}
            variant="light"
          >
            ログインへ戻る
          </Button>
        </>
      )}
    </section>
  )
}
