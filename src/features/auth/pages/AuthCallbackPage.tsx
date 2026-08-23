import { Button } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { useAuthRuntime } from '../AuthRuntimeProvider'

export function AuthCallbackPage() {
  const { readiness } = useAuthRuntime()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [uiStatus, setUiStatus] = useState<'error' | 'processing'>('processing')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      return
    }

    started.current = true
    const providerError = searchParams.has('error') || searchParams.has('error_description')

    if (providerError) {
      // Scrub provider error details from the address bar without echoing them into the UI.
      void navigate('/auth/callback', { replace: true })
      setUiStatus('error')
    }
  }, [navigate, searchParams])

  useEffect(() => {
    if (uiStatus === 'error') {
      return
    }

    if (readiness.status === 'authenticated') {
      void navigate('/', { replace: true })
      return
    }

    if (readiness.status === 'error') {
      void navigate('/auth/callback', { replace: true })
      setUiStatus('error')
      return
    }

    if (readiness.status === 'unauthenticated' && !searchParams.has('code')) {
      setUiStatus('error')
    }
  }, [navigate, readiness.status, searchParams, uiStatus])

  return (
    <section className="auth-panel" aria-labelledby="callback-title" aria-live="polite">
      <p className="auth-panel__brand">Re:Me</p>

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
