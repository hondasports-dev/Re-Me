/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_E2E_DB_LOGIN?: string
  readonly VITE_AUTH0_CLIENT_ID?: string
  readonly VITE_AUTH0_DOMAIN?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_WEB_PUSH_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
