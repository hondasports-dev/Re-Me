import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'

import {
  authSession as defaultAuthSession,
  type AuthSessionManager,
  type AuthStatus,
} from './auth-session'

interface AuthSessionContextValue {
  manager: AuthSessionManager
  session: Session | null
  status: AuthStatus
  initializeError: string | null
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

interface AuthSessionProviderProps {
  children: ReactNode
  manager?: AuthSessionManager
}

export function AuthSessionProvider({
  children,
  manager = defaultAuthSession,
}: AuthSessionProviderProps) {
  const session = useSyncExternalStore(
    (listener) => manager.subscribe(listener),
    () => manager.session,
    () => manager.session,
  )
  const status = useSyncExternalStore(
    (listener) => manager.subscribe(listener),
    () => manager.status,
    () => manager.status,
  )

  const initializeError = useMemo(() => {
    return status === 'error' ? 'session_restore_failed' : null
  }, [status])

  useEffect(() => {
    void manager.initialize().catch(() => undefined)
  }, [manager])

  const value = useMemo(
    () => ({
      initializeError,
      manager,
      session,
      status,
    }),
    [initializeError, manager, session, status],
  )

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext)

  if (!value) {
    throw new Error('auth_session_provider_missing')
  }

  return value
}
