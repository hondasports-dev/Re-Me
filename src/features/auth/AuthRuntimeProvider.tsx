import { createContext, useContext, type ReactNode } from 'react'

import type { AuthRuntime } from './auth-runtime'

const AuthRuntimeContext = createContext<AuthRuntime | null>(null)

interface AuthRuntimeProviderProps {
  children: ReactNode
  value: AuthRuntime
}

export function AuthRuntimeProvider({ children, value }: AuthRuntimeProviderProps) {
  return <AuthRuntimeContext.Provider value={value}>{children}</AuthRuntimeContext.Provider>
}

export function useAuthRuntime(): AuthRuntime {
  const value = useContext(AuthRuntimeContext)

  if (!value) {
    throw new Error('auth_runtime_provider_missing')
  }

  return value
}
