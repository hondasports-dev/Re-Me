import type { AuthConfig } from 'convex/server'

export function createAuthConfig(env: {
  AUTH0_CLIENT_ID?: string
  AUTH0_DOMAIN?: string
}): AuthConfig {
  const applicationID = env.AUTH0_CLIENT_ID?.trim()
  const domain = env.AUTH0_DOMAIN?.trim()

  // Convex platform rejects JWTs whose issuer/audience do not match these providers.
  return {
    providers:
      applicationID && domain
        ? [
            {
              applicationID,
              domain,
            },
          ]
        : [],
  }
}

export default createAuthConfig({
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
})
