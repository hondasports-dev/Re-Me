import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { assertBrowserSafeSupabaseKey } from '../config/supabase-key'
import type { Database } from '../types/database.generated'

export interface BrowserSupabaseConfig {
  publishableKey: string
  url: string
}

interface BrowserSupabaseEnv {
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_URL?: string
}

let client: SupabaseClient<Database> | undefined

export function readBrowserSupabaseConfig(
  env: BrowserSupabaseEnv = {
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  },
): BrowserSupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    throw new Error('supabase_configuration_missing')
  }

  assertBrowserSafeSupabaseKey(publishableKey)

  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('supabase_configuration_invalid')
  }

  const isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'

  if (parsedUrl.protocol !== 'https:' && !(isLocal && parsedUrl.protocol === 'http:')) {
    throw new Error('supabase_configuration_invalid')
  }

  return { publishableKey, url: parsedUrl.origin }
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) {
    return client
  }

  const config = readBrowserSupabaseConfig()

  client = createClient<Database>(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
    },
  })

  return client
}
