import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { createMiddleware } from 'hono/factory'

import { HttpError } from './errors'
import type { AppEnv, AppVariables, AuthenticatedUser } from './types'

type Jwks = ReturnType<typeof createRemoteJWKSet>

const jwksCache = new Map<string, Jwks>()

export const requireAuth = createMiddleware<{
  Bindings: AppEnv
  Variables: AppVariables
}>(async (context, next) => {
  const user = await authenticateRequest(context.req.raw, context.env)
  context.set('user', user)
  await next()
})

export async function authenticateRequest(
  request: Request,
  env: AppEnv,
): Promise<AuthenticatedUser> {
  const testUser = readLocalTestUser(request, env)
  if (testUser) {
    return testUser
  }

  const authorization = request.headers.get('authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    throw new HttpError(401, 'authentication_required')
  }

  const domain = normalizeDomain(env.AUTH0_DOMAIN)
  const audience = env.AUTH0_AUDIENCE?.trim() || env.AUTH0_CLIENT_ID?.trim()

  if (!domain || !audience) {
    throw new HttpError(503, 'auth_configuration_missing')
  }

  const issuer = `https://${domain}/`
  const jwks = getJwks(issuer)

  try {
    const verified = await jwtVerify(match[1], jwks, {
      issuer,
      audience,
    })
    return toAuthenticatedUser(verified.payload)
  } catch {
    throw new HttpError(401, 'authentication_invalid')
  }
}

function getJwks(issuer: string): Jwks {
  const cached = jwksCache.get(issuer)
  if (cached) {
    return cached
  }

  const jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`))
  jwksCache.set(issuer, jwks)
  return jwks
}

function toAuthenticatedUser(payload: JWTPayload): AuthenticatedUser {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new HttpError(401, 'authentication_invalid')
  }

  return {
    tokenIdentifier: payload.sub,
    email: claimString(payload.email),
    name: claimString(payload.name),
    pictureUrl: claimString(payload.picture),
  }
}

function claimString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function normalizeDomain(value: string | undefined): string | null {
  const domain = value
    ?.trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
  if (!domain || domain.includes('/') || domain.includes('@')) {
    return null
  }
  return domain
}

function readLocalTestUser(request: Request, env: AppEnv): AuthenticatedUser | null {
  if (env.APP_ENV !== 'local' || env.E2E_ALLOW_TEST_AUTH !== '1') {
    return null
  }

  const value = request.headers.get('x-re-me-test-user')?.trim()
  if (!value) {
    return null
  }

  const [tokenIdentifier, email, name] = value.split('|')
  if (!tokenIdentifier || tokenIdentifier.includes(' ')) {
    throw new HttpError(401, 'authentication_invalid')
  }

  return {
    tokenIdentifier,
    email: email || undefined,
    name: name || undefined,
  }
}
