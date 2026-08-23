export type ConvexSessionState = 'error' | 'idle' | 'loading' | 'ready'

export function resolveConvexSessionState(input: {
  isAuthenticated: boolean
  provisionError: Error | null
  user: { userId: string } | null
}): ConvexSessionState {
  if (!input.isAuthenticated) {
    return 'idle'
  }

  if (input.provisionError) {
    return 'error'
  }

  if (input.user) {
    return 'ready'
  }

  return 'loading'
}
