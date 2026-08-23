import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/convex/**/*.test.ts'],
    setupFiles: ['./tests/convex/setup.ts'],
    server: {
      deps: {
        inline: ['convex-test'],
      },
    },
  },
})
