/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_E2E_DB_LOGIN?: string
  readonly VITE_AUTH0_CLIENT_ID?: string
  readonly VITE_AUTH0_DOMAIN?: string
  readonly VITE_CONVEX_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
