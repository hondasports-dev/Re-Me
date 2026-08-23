import type { AuthConfig } from 'convex/server'

const domain = process.env.AUTH0_DOMAIN
const applicationID = process.env.AUTH0_CLIENT_ID

export default {
  providers:
    domain && applicationID
      ? [
          {
            applicationID,
            domain,
          },
        ]
      : [],
} satisfies AuthConfig
