interface JwtPayload {
  role?: unknown
}

export function assertBrowserSafeSupabaseKey(key: string | undefined): void {
  const normalizedKey = key?.trim()

  if (!normalizedKey) {
    return
  }

  if (normalizedKey.startsWith('sb_secret_') || hasServiceRoleClaim(normalizedKey)) {
    throw new Error('privileged_browser_credential_rejected')
  }
}

function hasServiceRoleClaim(key: string): boolean {
  const payload = key.split('.')[1]

  if (!payload) {
    return false
  }

  try {
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/')
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const parsed = JSON.parse(atob(paddedBase64)) as JwtPayload
    return parsed.role === 'service_role'
  } catch {
    return false
  }
}
