import { Button } from '@mantine/core'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { useAuthRuntime } from '../features/auth/AuthRuntimeProvider'

export function App() {
  const { logout, readiness } = useAuthRuntime()
  const location = useLocation()
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="brand-mark" aria-label="Re:Me 未来のあなたへ">
          <span className="brand-mark__name">Re:Me</span>
          <span className="brand-mark__tagline">未来のあなたへ</span>
        </div>

        {readiness.status === 'authenticated' ? (
          <Button
            className="app-shell__logout"
            disabled={isLoggingOut}
            onClick={() => {
              void handleLogout()
            }}
            variant="subtle"
          >
            ログアウト
          </Button>
        ) : null}
      </header>

      {logoutError ? (
        <p className="app-shell__alert" role="alert">
          {logoutError}
        </p>
      ) : null}

      <main className="app-shell__main" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  )
}
