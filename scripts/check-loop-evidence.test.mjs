import { describe, expect, it } from 'vitest'
import {
  evaluateLearningApplication,
  evaluateReviewEvidence,
  evaluateVerificationEvidence,
  extractLearningRecord,
} from './check-loop-evidence.mjs'

describe('check-loop-evidence', () => {
  it('accepts no learning event only with NOT_REQUIRED and no candidates', () => {
    const result = evaluateLearningApplication({
      learning: { event: 'none', status: 'not_required', candidates: [] },
    })
    expect(result).toEqual({ ok: true, errors: [] })
  })

  it('rejects a learning event without PASS', () => {
    const result = evaluateLearningApplication({
      learning: { event: 'review_finding', status: 'not_required', candidates: [] },
    })
    expect(result.ok).toBe(false)
  })

  it('requires durable evidence for applied learning', () => {
    const result = evaluateLearningApplication({
      userRequestedCurrentPrApply: true,
      learning: {
        event: 'human_correction',
        status: 'pass',
        candidates: [
          {
            observed_problem: 'manual rule was skipped',
            process_cause: 'no deterministic enforcement',
            reusable_rule: 'enforce reusable process invariants with a script',
            improvement_axes: ['precision'],
            proposed_target: 'scripts/check-loop-evidence.mjs',
            disposition: 'applied',
            evidence: ['task-state learning record'],
            location: 'scripts/check-loop-evidence.mjs',
            verification_evidence: ['targeted unit tests pass'],
          },
        ],
      },
    })
    expect(result).toEqual({ ok: true, errors: [] })
  })

  it('requires persistent follow-up metadata', () => {
    const result = evaluateLearningApplication({
      learning: {
        event: 'scope_miss',
        status: 'pass',
        candidates: [
          {
            observed_problem: 'scope follow-up needed',
            process_cause: 'current PR is intentionally narrow',
            reusable_rule: 'persist out-of-scope reusable work',
            improvement_axes: ['context'],
            proposed_target: 'issue',
            disposition: 'follow_up',
            evidence: ['current scope'],
            rationale: 'out of scope',
            persistent_follow_up: { type: 'issue', reference: '#123' },
          },
        ],
      },
    })
    expect(result.ok).toBe(true)
  })

  it('limits learning candidates to three', () => {
    const candidate = {
      observed_problem: 'x',
      process_cause: 'y',
      reusable_rule: 'z',
      improvement_axes: ['speed'],
      proposed_target: 'skill',
      disposition: 'no_change',
      rationale: 'already enforced',
      evidence: ['rule exists'],
    }
    const result = evaluateLearningApplication({
      learning: {
        event: 'incident',
        status: 'pass',
        candidates: [candidate, candidate, candidate, candidate],
      },
    })
    expect(result.ok).toBe(false)
  })

  it('extracts learning from a task-state-like object', () => {
    expect(extractLearningRecord({ learning: { event: 'none' } })).toEqual({ event: 'none' })
  })

  it('accepts targeted verification evidence', () => {
    const result = evaluateVerificationEvidence({
      evidence: {
        status: 'PASS',
        evidence_snapshot: 'commit abc / tree def',
        affected_scope: ['scripts/check-loop-evidence.mjs'],
        checks: [
          {
            name: 'loop unit tests',
            authority: 'local',
            scope: 'targeted',
            status: 'PASS',
          },
        ],
        reruns: [],
      },
    })
    expect(result).toEqual({ ok: true, errors: [] })
  })

  it('rejects duplicate full checks without a reason', () => {
    const result = evaluateVerificationEvidence({
      evidence: {
        status: 'PASS',
        evidence_snapshot: 'tree def',
        affected_scope: ['repository'],
        checks: [
          { name: 'full test', authority: 'local', scope: 'full_repository', status: 'PASS' },
          { name: 'full test', authority: 'ci', scope: 'full_repository', status: 'PASS' },
        ],
        reruns: [],
      },
    })
    expect(result.ok).toBe(false)
  })

  it('allows review NOT_REQUIRED when controls do not require review', () => {
    const result = evaluateReviewEvidence({
      evidence: {
        required: false,
        status: 'NOT_REQUIRED',
        not_required_reason: 'R1 process-only targeted change with no review control',
      },
    })
    expect(result).toEqual({ ok: true, errors: [] })
  })

  it('requires independent evidence when review is required', () => {
    const result = evaluateReviewEvidence({
      headSha: 'abc',
      evidence: {
        required: true,
        status: 'PASS',
        reviewed_revision: { commit_sha: 'abc', tree_sha: 'tree' },
        reviewers: [
          {
            independence_attested: true,
            viewpoints: ['correctness', 'regression'],
          },
        ],
      },
    })
    expect(result).toEqual({ ok: true, errors: [] })
  })
})
