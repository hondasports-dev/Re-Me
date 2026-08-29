import { describe, expect, it } from 'vitest'
import {
  formatE2eEnvReport,
  hasRequiredE2eAuth0Values,
  parseDotEnv,
  planE2eAuth0Sync,
} from './sync-worktree-e2e-env.mjs'
import {
  evaluateLocalE2eGate,
  isCredentialOmissionReason,
  pathsRequireBrowserE2e,
} from './check-local-e2e-gate.mjs'

describe('sync-worktree-e2e-env', () => {
  it('copies missing Auth0 keys without overwriting existing ones', () => {
    const plan = planE2eAuth0Sync({
      currentText: 'E2E_AUTH0_EMAIL=existing@example.com\nVITE_CONVEX_URL=http://127.0.0.1:3210\n',
      sourceText:
        'E2E_AUTH0_EMAIL=canonical@example.com\nE2E_AUTH0_PASSWORD=canonical-secret\nE2E_AUTH0_CONNECTION=Username-Password-Authentication\n',
    })

    expect(plan.copied).toEqual(['E2E_AUTH0_PASSWORD', 'E2E_AUTH0_CONNECTION'])
    expect(plan.alreadyPresent).toEqual(['E2E_AUTH0_EMAIL'])
    expect(plan.nextText).toContain('E2E_AUTH0_EMAIL=existing@example.com')
    expect(plan.nextText).toContain('VITE_CONVEX_URL=http://127.0.0.1:3210')
    expect(plan.nextText).toContain('E2E_AUTH0_PASSWORD=canonical-secret')
    expect(plan.nextText).not.toContain('canonical@example.com')
  })

  it('reports key names without secret values', () => {
    const report = formatE2eEnvReport({
      copied: ['E2E_AUTH0_PASSWORD'],
      alreadyPresent: ['E2E_AUTH0_EMAIL'],
      missingInSource: [],
    })
    expect(report).toBe('copied E2E_AUTH0_PASSWORD from canonical; already present E2E_AUTH0_EMAIL')
    expect(report).not.toContain('canonical-secret')
    expect(report).not.toContain('@example.com')
  })

  it('detects required keys without exposing values', () => {
    const values = parseDotEnv(
      'E2E_AUTH0_EMAIL=user@example.com\nE2E_AUTH0_PASSWORD=super-secret\n',
    ).values
    expect(hasRequiredE2eAuth0Values(values)).toBe(true)
    expect(
      hasRequiredE2eAuth0Values(parseDotEnv('E2E_AUTH0_EMAIL=user@example.com\n').values),
    ).toBe(false)
  })
})

describe('check-local-e2e-gate', () => {
  it('does not require browser E2E for loop scripts', () => {
    expect(
      pathsRequireBrowserE2e(['scripts/check-local-e2e-gate.mjs', 'skills/verification/SKILL.md']),
    ).toBe(false)
    expect(
      evaluateLocalE2eGate({
        changedFiles: ['scripts/check-local-e2e-gate.mjs'],
        hasEmail: false,
        hasPassword: false,
      }),
    ).toEqual({ ok: true, required: false, errors: [] })
  })

  it('requires local credentials when user-visible screens changed', () => {
    expect(pathsRequireBrowserE2e(['src/features/inbox/pages/InboxPage.tsx'])).toBe(true)
    const result = evaluateLocalE2eGate({
      changedFiles: ['src/features/inbox/pages/InboxPage.tsx'],
      hasEmail: false,
      hasPassword: false,
    })
    expect(result.ok).toBe(false)
    expect(result.required).toBe(true)
    expect(result.errors[0]).toContain('CI End-to-end is not a substitute')
  })

  it('passes the local gate once credentials are present', () => {
    expect(
      evaluateLocalE2eGate({
        changedFiles: ['e2e/inbox.spec.ts'],
        hasEmail: true,
        hasPassword: true,
      }),
    ).toEqual({ ok: true, required: true, errors: [] })
  })

  it('treats credential shortage wording as a forbidden NOT_REQUIRED reason', () => {
    expect(isCredentialOmissionReason('E2E_AUTH0 credentials missing')).toBe(true)
    expect(isCredentialOmissionReason('資格情報がないので CI で確認')).toBe(true)
    expect(isCredentialOmissionReason('no user-visible screen change')).toBe(false)
  })
})
