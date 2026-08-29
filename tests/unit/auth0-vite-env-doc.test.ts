import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Auth0 Vite env setup docs', () => {
  const setup = readFileSync(resolve('docs/development/setup.md'), 'utf8')
  const preview = readFileSync(resolve('docs/development/preview-environment.md'), 'utf8')
  const gitignore = readFileSync(resolve('.gitignore'), 'utf8')

  it('tells how to set VITE_AUTH0_* from the Re:Me DEV SPA via Auth0 CLI', () => {
    expect(setup).toContain('### `VITE_AUTH0_*` の入れ方')
    expect(setup).toContain('auth0 login')
    expect(setup).toContain('auth0 apps list')
    expect(setup).toContain('Re:Me DEV')
    expect(setup).toContain('auth0 tenants list')
    expect(setup).toContain('新しい SPA は作らない')
    expect(setup).toContain('pnpm loop:preflight')
    expect(setup).toContain('E2E_AUTH0_EMAIL')
    expect(setup).not.toMatch(/VITE_AUTH0_CLIENT_SECRET/)
  })

  it('points Local and worktree steps at the same Auth0 CLI procedure', () => {
    expect(preview).toContain('`VITE_AUTH0_*` の入れ方')
    expect(preview).toContain('setup.md')
    expect(preview).toContain('Re:Me DEV')
    expect(preview).toContain('pnpm loop:preflight')
    expect(preview).toContain('convex env set --force --deployment local --from-file')
  })

  it('keeps Auth0 CLI tokens out of git', () => {
    expect(setup).toContain('.config/auth0/')
    expect(gitignore).toMatch(/(^|\n)\.config\/(\n|$)/)
  })
})
