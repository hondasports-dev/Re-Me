import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react'

export interface ApiClientOptions {
  baseUrl?: string
  getToken?: () => Promise<string | null>
}

export interface ApiClient {
  request<T>(path: string, options?: RequestInit): Promise<T>
}

const ApiClientContext = createContext<ApiClient | null>(null)

export function ApiClientProvider({
  children,
  options,
}: {
  children: ReactNode
  options?: ApiClientOptions
}) {
  const baseUrl = options?.baseUrl
  const getToken = options?.getToken
  const client = useMemo(() => createApiClient({ baseUrl, getToken }), [baseUrl, getToken])
  return createElement(ApiClientContext.Provider, { value: client }, children)
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext)
  if (!client) throw new Error('api_client_provider_missing')
  return client
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl?.trim().replace(/\/$/u, '') ?? ''
  const getToken = options.getToken ?? (async () => null)

  return {
    async request<T>(path: string, requestOptions: RequestInit = {}): Promise<T> {
      const token = await getToken()
      const headers = new Headers(requestOptions.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (requestOptions.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      const response = await fetch(`${baseUrl}${path}`, { ...requestOptions, headers })
      const text = await response.text()
      let payload: unknown = null
      if (text) {
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          payload = text
        }
      }
      if (!response.ok) {
        const code =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : `http_${response.status}`
        throw new ApiRequestError(response.status, code)
      }
      return payload as T
    },
  }
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}
