import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type UserConfig } from 'vite'

import { assertBrowserSafeViteEnv } from './src/shared/config/browser-env.ts'

type BrowserBuildEnv = Record<string, string | undefined>

export function createViteConfig(env: BrowserBuildEnv): UserConfig {
  // This must run before Vite substitutes VITE_* values into public assets.
  assertBrowserSafeViteEnv(env)

  return {
    plugins: [react(), cloudflare()],
    server: {
      host: '127.0.0.1',
    },
  }
}

export default defineConfig(({ mode }) => createViteConfig(loadEnv(mode, process.cwd(), '')))
