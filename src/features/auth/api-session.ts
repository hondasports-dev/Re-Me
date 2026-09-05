export type ApiSessionState = 'error' | 'idle' | 'loading' | 'ready'

export function resolveApiSessionState(input: {
  isAuthenticated: boolean
  provisionError: Error | null
  user: { userId: string } | null
}): ApiSessionState {
  if (!input.isAuthenticated) return 'idle'
  if (input.provisionError) return 'error'
  if (!input.user) return 'loading'
  return 'ready'
}
