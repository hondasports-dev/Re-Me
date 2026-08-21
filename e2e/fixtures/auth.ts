import { createClient, type Session } from '@supabase/supabase-js'
import { test as base, expect, type Page } from '@playwright/test'

const supabaseUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const supabasePublishableKey =
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
const testEmail = process.env.E2E_AUTH_EMAIL ?? 'e2e-user@example.com'
const testPassword = process.env.E2E_AUTH_PASSWORD ?? 'e2e-password-123456'

export function hasLocalAuthCredentials(): boolean {
  return Boolean(supabasePublishableKey && process.env.E2E_AUTH_ENABLED === '1')
}

async function createLocalTestSession(): Promise<Session> {
  const client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  const signIn = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })

  if (signIn.data.session) {
    return signIn.data.session
  }

  const signUp = await client.auth.signUp({
    email: testEmail,
    password: testPassword,
  })

  if (signUp.data.session) {
    return signUp.data.session
  }

  const retry = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })

  if (!retry.data.session) {
    throw new Error(retry.error?.message ?? signUp.error?.message ?? 'local_auth_session_failed')
  }

  return retry.data.session
}

async function injectSession(page: Page, session: Session): Promise<void> {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0] ?? '127'
  const storageKey = `sb-${projectRef}-auth-token`

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value)
    },
    {
      key: storageKey,
      value: JSON.stringify(session),
    },
  )
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    const session = await createLocalTestSession()
    await injectSession(page, session)
    await use(page)
  },
})

export { expect }
