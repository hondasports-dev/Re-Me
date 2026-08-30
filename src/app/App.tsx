import { AppShell, Button } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'

import { useAuthRuntime } from '../features/auth/AuthRuntimeProvider'
import { BottomNav } from './BottomNav'

export function App() {
  const { logout, readiness } = useAuthRuntime()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const showAppChrome = readiness.status === 'authenticated'
  const isCompose =
    location.pathname.startsWith('/write') ||
    /\/letters\/[^/]+\/reply(?:\/|$)/.test(location.pathname)
  const isDetail =
    isCompose ||
    /^\/letters\/[^/]+$/.test(location.pathname) ||
    /^\/traveling\/[^/]+$/.test(location.pathname) ||
    /^\/threads\/[^/]+$/.test(location.pathname)
  const screenTitle = appScreenTitle(location.pathname)
  const backPath = appBackPath(location.pathname)
  const compactHeader = showAppChrome

  async function handleLogout(): Promise<void> {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await logout()
    } catch {
      setLogoutError('ログアウト処理を完了できませんでした。もう一度お試しください。')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <AppShell
      className="re-me-shell"
      data-chrome={showAppChrome ? 'app' : 'guest'}
      data-compose={isCompose ? 'true' : 'false'}
      data-detail={isDetail ? 'true' : 'false'}
      data-screen={screenKind(location.pathname)}
      footer={showAppChrome ? { height: 'var(--re-me-nav-height)' } : undefined}
      header={showAppChrome ? { height: 'var(--re-me-header-height)' } : undefined}
      transitionDuration={reduceMotion ? 0 : 220}
    >
      {showAppChrome ? (
        <AppShell.Header
          className={`re-me-shell__header${compactHeader ? ' re-me-shell__header--compact' : ''}`}
        >
          <div className="re-me-shell__header-inner">
            {compactHeader ? (
              <>
                <Link aria-label="戻る" className="re-me-shell__back" to={backPath}>
                  <span aria-hidden="true">‹</span>
                </Link>
                <span className="re-me-shell__screen-title">{screenTitle}</span>
                {isDetail ? (
                  <span className="re-me-shell__header-status">
                    {isCompose && !location.pathname.endsWith('/send') ? '下書き保存' : ''}
                  </span>
                ) : (
                  <div className="re-me-shell__header-actions">
                    <Link className="re-me-shell__settings" to="/settings">
                      設定
                    </Link>
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
                )}
              </>
            ) : null}
          </div>
        </AppShell.Header>
      ) : null}

      <AppShell.Main className="re-me-shell__main">
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

function screenKind(pathname: string): 'list' | 'compose' | 'detail' | 'settings' {
  if (pathname === '/settings') return 'settings'
  if (pathname.startsWith('/write') || /\/letters\/[^/]+\/reply(?:\/|$)/.test(pathname)) {
    return 'compose'
  }
  if (
    /^\/letters\/[^/]+$/.test(pathname) ||
    /^\/traveling\/[^/]+$/.test(pathname) ||
    /^\/threads\/[^/]+$/.test(pathname)
  ) {
    return 'detail'
  }
  return 'list'
}

function appScreenTitle(pathname: string): string {
  if (pathname.endsWith('/send')) return '届ける時期を選ぶ'
  if (pathname.includes('/reply')) return '未来へ返信する'
  if (pathname.startsWith('/write')) return '手紙を書く'
  if (pathname === '/') return '受信箱'
  if (pathname === '/traveling') return '未来を旅する手紙'
  if (pathname === '/settings') return '設定'
  if (/^\/letters\/[^/]+$/.test(pathname)) return '届いた手紙'
  if (/^\/traveling\/[^/]+$/.test(pathname)) return '未来を旅する手紙'
  if (/^\/threads\/[^/]+$/.test(pathname)) return '時間をまたぐ手紙'
  return ''
}

function appBackPath(pathname: string): string {
  const replyMatch = pathname.match(/^\/letters\/([^/]+)\/reply/)
  if (replyMatch) {
    return pathname.endsWith('/send')
      ? `/letters/${replyMatch[1]}/reply`
      : `/letters/${replyMatch[1]}`
  }
  const writeMatch = pathname.match(/^\/write\/([^/]+)/)
  if (writeMatch) return pathname.endsWith('/send') ? `/write/${writeMatch[1]}` : '/'
  if (pathname === '/traveling') return '/'
  if (/^\/traveling\/[^/]+$/.test(pathname)) return '/traveling'
  return '/'
}
