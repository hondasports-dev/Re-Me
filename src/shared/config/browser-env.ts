export interface LiveBrowserAuthConfig {
  kind: 'live'
  auth0ClientId: string
  auth0Domain: string
  convexUrl: string
}

export interface UnconfiguredBrowserAuthConfig {
  kind: 'unconfigured'
}

export type BrowserAuthConfig = LiveBrowserAuthConfig | UnconfiguredBrowserAuthConfig

interface BrowserAuthEnv {
  readonly VITE_AUTH0_CLIENT_ID?: string
  readonly VITE_AUTH0_DOMAIN?: string
  readonly VITE_CONVEX_URL?: string
}

const PRIVILEGED_VITE_NAME =
  /SECRET|PRIVATE_KEY|SERVICE_ROLE|DEPLOY_KEY|MANAGEMENT|ACCESS_TOKEN|VAPID_PRIVATE/i

export function assertBrowserSafeViteEnv(env: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('VITE_')) {
      continue
    }

    if (PRIVILEGED_VITE_NAME.test(name) || looksLikePrivilegedValue(value)) {
      throw new Error('privileged_browser_credential_rejected')
    }
  }
}

export function readBrowserAuthConfig(
  env: BrowserAuthEnv = {
    VITE_AUTH0_CLIENT_ID: import.meta.env.VITE_AUTH0_CLIENT_ID,
    VITE_AUTH0_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN,
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
  },
): BrowserAuthConfig {
  const auth0Domain = env.VITE_AUTH0_DOMAIN?.trim() ?? ''
  const auth0ClientId = env.VITE_AUTH0_CLIENT_ID?.trim() ?? ''
  const convexUrl = env.VITE_CONVEX_URL?.trim() ?? ''
  const presentCount = [auth0Domain, auth0ClientId, convexUrl].filter(Boolean).length

  if (presentCount === 0) {
    return { kind: 'unconfigured' }
  }

  if (presentCount !== 3) {
    throw new Error('browser_auth_configuration_incomplete')
  }

  assertAuth0Domain(auth0Domain)
  assertConvexUrl(convexUrl)

  return {
    kind: 'live',
    auth0ClientId,
    auth0Domain,
    convexUrl,
  }
}

export function createAuth0RedirectUri(origin: string): string {
  return `${origin}/auth/callback`
}

function assertAuth0Domain(domain: string): void {
  if (domain.includes('://') || domain.includes('/') || domain.includes('@')) {
    throw new Error('browser_auth_configuration_invalid')
  }
}

function assertConvexUrl(url: string): void {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new Error('browser_auth_configuration_invalid')
  }

  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  const isConvexHost =
    parsed.hostname.endsWith('.convex.cloud') || parsed.hostname.endsWith('.convex.site')

  if (parsed.protocol !== 'https:' && !(isLocal && parsed.protocol === 'http:')) {
    throw new Error('browser_auth_configuration_invalid')
  }

  if (!isLocal && !isConvexHost) {
    throw new Error('browser_auth_configuration_invalid')
  }
}

function looksLikePrivilegedValue(value: string | undefined): boolean {
  const normalized = value?.trim()

  if (!normalized) {
    return false
  }

  return (
    normalized.includes('BEGIN PRIVATE KEY') ||
    normalized.startsWith('cvx_') ||
    normalized.startsWith('sb_secret_') ||
    hasServiceRoleClaim(normalized)
  )
}

function hasServiceRoleClaim(key: string): boolean {
  const payload = key.split('.')[1]

  if (!payload) {
    return false
  }

  try {
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const parsed = JSON.parse(atob(paddedBase64)) as { role?: unknown }
    return parsed.role === 'service_role'
  } catch {
    return false
  }
}
