export interface AuthenticatedUser {
  tokenIdentifier: string
  email?: string
  name?: string
  pictureUrl?: string
}

export interface AppVariables {
  user: AuthenticatedUser
}

export type AppEnv = Env & {
  AUTH0_DOMAIN?: string
  AUTH0_AUDIENCE?: string
  AUTH0_CLIENT_ID?: string
  CAPABILITY_SECRET?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
  WEB_ORIGINS?: string
  E2E_ALLOW_TEST_AUTH?: string
  E2E_ALLOW_FORCE_DELIVERY?: string
}
