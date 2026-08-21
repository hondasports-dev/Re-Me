import { Button } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { useAuthSession } from '../features/auth/AuthSessionProvider'

export function App() {
  const { manager, session } = useAuthSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    return manager.onSessionChange((nextSession) => {
      queueMicrotask(() => {
        const path = window.location.pathname

        if (!nextSession && path !== '/login' && path !== '/auth/callback') {
          void navigate('/login', { replace: true })
        } else if (nextSession && (path === '/login' || path === '/auth/callback')) {
          void navigate('/', { replace: true })
        }
      })
    })
  }, [manager, navigate])

  async function logout(): Promise<void> {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await manager.signOut()
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

        {session ? (
          <Button
            className="app-shell__logout"
            disabled={isLoggingOut}
            onClick={() => {
              void logout()
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
