import { cloudflare } from '@cloudflare/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type UserConfig } from 'vite'

import { assertBrowserSafeViteEnv } from './src/shared/config/supabase-key.ts'

type BrowserBuildEnv = Record<string, string | undefined>

export function createViteConfig(env: BrowserBuildEnv): UserConfig {
  // This must run before Vite substitutes VITE_* values into public assets.
  assertBrowserSafeViteEnv(env)

  return {
    plugins: [vue(), cloudflare()],
  }
}

export default defineConfig(({ mode }) => createViteConfig(loadEnv(mode, process.cwd(), '')))
