import { authSession, type AuthSessionReader } from '../../features/auth/auth-session'

export class WorkerApiError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'WorkerApiError'
  }
}

export function createWorkerApiFetch(
  auth: AuthSessionReader = authSession,
  fetchImplementation: typeof fetch = fetch,
): (path: string, init?: RequestInit) => Promise<Response> {
  const activeRequests = new Set<AbortController>()

  auth.onSessionChange((session) => {
    if (!session) {
      for (const controller of activeRequests) {
        controller.abort()
      }
      activeRequests.clear()
    }
  })

  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    let requestUrl: URL

    try {
      requestUrl = new URL(path, window.location.origin)
    } catch {
      throw new WorkerApiError('worker_api_path_invalid')
    }

    const rawPathname = path.split(/[?#]/, 1)[0]
    const hasEncodedTraversal = /%(?:2e|2f|5c)/i.test(rawPathname)
    const isCanonicalRelativeApiPath =
      path.startsWith('/') &&
      !path.startsWith('//') &&
      requestUrl.origin === window.location.origin &&
      requestUrl.pathname === rawPathname &&
      /^\/api(?:\/|$)/.test(requestUrl.pathname) &&
      !hasEncodedTraversal

    if (!isCanonicalRelativeApiPath) {
      throw new WorkerApiError('worker_api_path_invalid')
    }

    const headers = new Headers(init.headers)

    if (headers.has('authorization')) {
      throw new WorkerApiError('authorization_header_managed')
    }

    const accessToken = await auth.getAccessToken()
    const requestEpoch = auth.epoch
    const controller = new AbortController()
    const abortFromCaller = (): void => controller.abort()

    if (init.signal?.aborted) {
      controller.abort()
    } else {
      init.signal?.addEventListener('abort', abortFromCaller, { once: true })
    }

    headers.set('authorization', `Bearer ${accessToken}`)
    activeRequests.add(controller)

    try {
      const response = await fetchImplementation(`${requestUrl.pathname}${requestUrl.search}`, {
        ...init,
        headers,
        signal: controller.signal,
      })

      if (requestEpoch !== auth.epoch) {
        throw new DOMException('The authenticated request is stale.', 'AbortError')
      }

      if (response.status === 401) {
        auth.handleUnauthorized()
      }

      return response
    } finally {
      activeRequests.delete(controller)
      init.signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

export const workerApiFetch = createWorkerApiFetch()
