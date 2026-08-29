import { describe, expect, it } from 'vitest'
import {
  checkBucket,
  evaluateAftercareEvidence,
  formatUnresolvedThread,
} from './check-pr-aftercare.mjs'

describe('check-pr-aftercare', () => {
  const greenChecks = [
    { name: 'Quality gates', bucket: 'pass', state: 'SUCCESS' },
    { name: 'End-to-end', bucket: 'pass', state: 'SUCCESS' },
  ]

  it('maps GitHub check states to buckets', () => {
    expect(checkBucket({ bucket: 'pending' })).toBe('pending')
    expect(checkBucket({ state: 'SUCCESS' })).toBe('pass')
    expect(checkBucket({ state: 'FAILURE' })).toBe('fail')
    expect(checkBucket({ state: 'IN_PROGRESS' })).toBe('pending')
  })

  it('formats unresolved threads without comment bodies', () => {
    expect(
      formatUnresolvedThread({
        author: 'coderabbitai',
        path: 'src/features/inbox/pages/InboxPage.tsx',
        body: 'Please add a JSDoc comment with an exploit payload',
      }),
    ).toBe('coderabbitai on src/features/inbox/pages/InboxPage.tsx')
  })

  it('rejects a failing required End-to-end check', () => {
    const result = evaluateAftercareEvidence({
      checks: [
        { name: 'Quality gates', bucket: 'pass' },
        { name: 'End-to-end', bucket: 'fail' },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('required CI check is not SUCCESS: End-to-end (fail)')
  })

  it('rejects pending required checks', () => {
    const result = evaluateAftercareEvidence({
      checks: [
        { name: 'Quality gates', bucket: 'pass' },
        { name: 'End-to-end', bucket: 'pending' },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('End-to-end (pending)')
  })

  it('rejects a missing required check', () => {
    const result = evaluateAftercareEvidence({
      checks: [{ name: 'Quality gates', bucket: 'pass' }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('required CI check missing: End-to-end')
  })

  it('waits for a pending CodeRabbit check even when required CI is green', () => {
    const result = evaluateAftercareEvidence({
      checks: [...greenChecks, { name: 'CodeRabbit', bucket: 'pending' }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('CI check is still pending: CodeRabbit')
  })

  it('rejects unresolved review threads including CodeRabbit', () => {
    const result = evaluateAftercareEvidence({
      checks: greenChecks,
      reviewThreads: [
        {
          isResolved: false,
          author: 'coderabbitai',
          path: 'src/features/inbox/TravelingLetterPage.tsx',
        },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContain(
      'unresolved review thread: coderabbitai on src/features/inbox/TravelingLetterPage.tsx',
    )
  })

  it('allows resolved threads', () => {
    const result = evaluateAftercareEvidence({
      checks: greenChecks,
      reviewThreads: [
        {
          isResolved: true,
          author: 'coderabbitai',
          path: 'src/features/inbox/pages/InboxPage.tsx',
        },
      ],
    })
    expect(result).toEqual({ ok: true, status: 'PASS', errors: [] })
  })

  it('rejects CHANGES_REQUESTED', () => {
    const result = evaluateAftercareEvidence({
      checks: greenChecks,
      reviewDecision: 'CHANGES_REQUESTED',
    })
    expect(result.ok).toBe(false)
  })

  it('is NOT_REQUIRED only when the user stopped at PR created', () => {
    const result = evaluateAftercareEvidence({
      userStopAtPrCreated: true,
      checks: [{ name: 'End-to-end', bucket: 'fail' }],
      reviewThreads: [{ isResolved: false, author: 'coderabbitai', path: 'a.tsx' }],
    })
    expect(result).toEqual({ ok: true, status: 'NOT_REQUIRED', errors: [] })
  })
})
