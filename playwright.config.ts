import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

import { authStatePath, hasAuth0E2eCredentials } from './e2e/fixtures/auth'

const loadedEnv = loadEnv('development', process.cwd(), '')

for (const [name, value] of Object.entries(loadedEnv)) {
  if (process.env[name] === undefined) {
    process.env[name] = value
  }
}

const auth0E2eReady = hasAuth0E2eCredentials()
const mobileUse = {
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Auth0 refresh-token rotation cannot be shared across parallel authenticated browsers.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1',
    env: {
      ...process.env,
      VITE_ALLOW_E2E_DB_LOGIN: '1',
    },
    reuseExistingServer: !process.env.CI,
    url: 'http://127.0.0.1:4173',
  },
  projects: [
    ...(auth0E2eReady
      ? [
          {
            name: 'auth-setup',
            testMatch: /auth\.setup\.ts/,
            use: mobileUse,
          },
        ]
      : []),
    {
      name: 'chromium-mobile',
      testIgnore: auth0E2eReady
        ? /auth\.setup\.ts|auth-session\.spec\.ts|compose\.spec\.ts|traveling\.spec\.ts|inbox\.spec\.ts|reply\.spec\.ts/
        : /auth\.setup\.ts/,
      use: mobileUse,
    },
    ...(auth0E2eReady
      ? [
          {
            name: 'chromium-authenticated',
            dependencies: ['auth-setup'],
            testMatch:
              /auth-session\.spec\.ts|compose\.spec\.ts|traveling\.spec\.ts|inbox\.spec\.ts|reply\.spec\.ts/,
            use: {
              ...mobileUse,
              storageState: authStatePath,
            },
          },
        ]
      : []),
  ],
})
