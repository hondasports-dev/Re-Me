import { AppShell, Button } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { useAuthRuntime } from '../features/auth/AuthRuntimeProvider'
import { BottomNav } from './BottomNav'

export function App() {
  const { logout, readiness } = useAuthRuntime()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const showAppChrome = readiness.status === 'authenticated'

  async function handleLogout(): Promise<void> {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await logout()
    } catch {
      setLogoutError('ログアウト処理を完了できませんでした。認証が必要な内容は閉じました。')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <AppShell
      className="re-me-shell"
      data-chrome={showAppChrome ? 'app' : 'guest'}
      footer={showAppChrome ? { height: 'var(--re-me-nav-height)' } : undefined}
      header={showAppChrome ? { height: 'var(--re-me-header-height)' } : undefined}
      transitionDuration={reduceMotion ? 0 : 220}
    >
      {showAppChrome ? (
        <AppShell.Header className="re-me-shell__header">
          <div className="re-me-shell__header-inner">
            <div className="brand-mark" aria-label="Re:Me 未来のあなたへ">
              <span className="brand-mark__name">Re:Me</span>
              <span className="brand-mark__tagline">未来のあなたへ</span>
            </div>

            <Button
              className="re-me-shell__logout"
              disabled={isLoggingOut}
              onClick={() => {
                void handleLogout()
              }}
              variant="subtle"
            >
              ログアウト
            </Button>
          </div>
        </AppShell.Header>
      ) : null}

      <AppShell.Main className="re-me-shell__main" key={location.pathname}>
        {logoutError ? (
          <p className="re-me-shell__alert" role="alert">
            {logoutError}
          </p>
        ) : null}
        <Outlet />
      </AppShell.Main>

      {showAppChrome ? (
        <AppShell.Footer className="re-me-shell__footer">
          <BottomNav />
        </AppShell.Footer>
      ) : null}
    </AppShell>
  )
}
