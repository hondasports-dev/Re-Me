import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isCredentialOmissionReason, pathsRequireBrowserE2e } from './check-local-e2e-gate.mjs'

const RESULT_STATUSES = new Set(['PASS', 'FAIL', 'NOT_REQUIRED', 'BLOCKED'])
const VERIFICATION_AUTHORITIES = new Set(['local', 'ci', 'runtime'])
const VERIFICATION_SCOPES = new Set([
  'targeted',
  'affected_scope',
  'full_repository',
  'functional_e2e',
  'regression_e2e',
  'static',
  'runtime',
])
const LEARNING_IMPROVEMENT_AXES = new Set(['context', 'speed', 'precision'])
const LEARNING_DISPOSITIONS = new Set(['applied', 'follow_up', 'no_change'])
const LEARNING_FOLLOW_UP_TYPES = new Set(['issue', 'task', 'pr'])

function isEmptyText(value) {
  return typeof value !== 'string' || value.trim() === ''
}

function isNonEmptyList(value) {
  return Array.isArray(value) && value.length > 0
}

function isNonEmptyTextList(value) {
  return isNonEmptyList(value) && value.every((item) => !isEmptyText(item))
}

function candidateValue(candidate, camelCaseKey, snakeCaseKey) {
  return candidate?.[snakeCaseKey] ?? candidate?.[camelCaseKey]
}

export function extractLearningRecord(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined
  return 'learning' in input ? input.learning : input
}

function validateLearningCandidate(candidate, index) {
  const errors = []
  for (const [camelCaseKey, snakeCaseKey] of [
    ['observedProblem', 'observed_problem'],
    ['processCause', 'process_cause'],
    ['reusableRule', 'reusable_rule'],
    ['proposedTarget', 'proposed_target'],
  ]) {
    if (isEmptyText(candidateValue(candidate, camelCaseKey, snakeCaseKey))) {
      errors.push(`candidate[${index}].${snakeCaseKey} is required`)
    }
  }

  const axes = candidateValue(candidate, 'improvementAxes', 'improvement_axes')
  if (!isNonEmptyList(axes) || axes.some((axis) => !LEARNING_IMPROVEMENT_AXES.has(axis))) {
    errors.push(
      `candidate[${index}].improvement_axes must contain only context, speed, or precision`,
    )
  }

  if (!isNonEmptyTextList(candidate?.evidence)) {
    errors.push(`candidate[${index}].evidence requires non-empty text entries`)
  }

  const disposition = candidate?.disposition
  if (!LEARNING_DISPOSITIONS.has(disposition)) {
    errors.push(`candidate[${index}].disposition must be applied, follow_up, or no_change`)
    return errors
  }

  if (disposition === 'applied') {
    if (isEmptyText(candidate?.location)) {
      errors.push(`candidate[${index}].location is required for applied`)
    }
    const verificationEvidence = candidateValue(
      candidate,
      'verificationEvidence',
      'verification_evidence',
    )
    if (!isNonEmptyTextList(verificationEvidence)) {
      errors.push(`candidate[${index}].verification_evidence is required for applied`)
    }
  }

  if (disposition === 'follow_up') {
    const followUp = candidateValue(candidate, 'persistentFollowUp', 'persistent_follow_up')
    if (
      followUp === null ||
      typeof followUp !== 'object' ||
      !LEARNING_FOLLOW_UP_TYPES.has(followUp.type) ||
      isEmptyText(followUp.reference)
    ) {
      errors.push(
        `candidate[${index}].persistent_follow_up requires type issue/task/pr and reference`,
      )
    }
    if (isEmptyText(candidate?.rationale)) {
      errors.push(`candidate[${index}].rationale is required for follow_up`)
    }
  }

  if (disposition === 'no_change' && isEmptyText(candidate?.rationale)) {
    errors.push(`candidate[${index}].rationale is required for no_change`)
  }

  return errors
}

export function evaluateLearningApplication({ userRequestedCurrentPrApply = false, learning }) {
  const errors = []
  if (learning === null || typeof learning !== 'object' || Array.isArray(learning)) {
    return { ok: false, errors: ['learning record is missing or invalid'] }
  }

  const event = learning.event
  const status = typeof learning.status === 'string' ? learning.status.toLowerCase() : ''
  const candidates = Array.isArray(learning.candidates) ? learning.candidates : []

  if (isEmptyText(event)) errors.push('learning.event is required')
  if (!Array.isArray(learning.candidates)) errors.push('learning.candidates must be an array')

  if (event === 'none') {
    if (status !== 'not_required') {
      errors.push('learning.status must be NOT_REQUIRED when event is none')
    }
    if (candidates.length > 0) {
      errors.push('learning.candidates must be empty when event is none')
    }
    if (userRequestedCurrentPrApply) {
      errors.push('current-PR apply cannot be requested when learning.event is none')
    }
    return { ok: errors.length === 0, errors }
  }

  if (status !== 'pass') errors.push('learning.status must be PASS when a learning event occurred')
  if (candidates.length > 3)
    errors.push('learning candidates must be limited to the 3 highest-impact items')

  for (const [index, candidate] of candidates.entries()) {
    errors.push(...validateLearningCandidate(candidate, index))
  }

  if (userRequestedCurrentPrApply) {
    if (candidates.length === 0) {
      errors.push('current-PR apply was requested but no learning candidates were recorded')
    }
    for (const [index, candidate] of candidates.entries()) {
      if (candidate?.disposition !== 'applied') {
        errors.push(`candidate[${index}] must be applied when current-PR apply was requested`)
      }
    }
  } else {
    for (const [index, candidate] of candidates.entries()) {
      if (candidate?.disposition === 'applied') {
        errors.push(`candidate[${index}] is applied without a current-PR apply request`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

function normalizeCheckName(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

export function evaluateVerificationEvidence({ evidence }) {
  const errors = []
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { ok: false, errors: ['verification evidence object is missing'] }
  }

  if (String(evidence.status).toUpperCase() !== 'PASS') {
    errors.push('verification.status must be PASS')
  }
  if (isEmptyText(evidence.evidence_snapshot)) {
    errors.push('verification evidence requires evidence_snapshot')
  }
  if (!isNonEmptyList(evidence.affected_scope)) {
    errors.push('verification evidence requires a non-empty affected_scope')
  }

  const checks = evidence.checks
  if (!isNonEmptyList(checks)) {
    errors.push('verification evidence requires a non-empty checks list')
    return { ok: false, errors }
  }

  const fullChecks = new Map()
  for (const [index, check] of checks.entries()) {
    if (check === null || typeof check !== 'object' || Array.isArray(check)) {
      errors.push(`check[${index}] must be an object`)
      continue
    }
    if (isEmptyText(check.name)) errors.push(`check[${index}].name is required`)
    if (!VERIFICATION_AUTHORITIES.has(check.authority)) {
      errors.push(`check[${index}].authority is invalid`)
    }
    if (!VERIFICATION_SCOPES.has(check.scope)) errors.push(`check[${index}].scope is invalid`)
    if (!RESULT_STATUSES.has(check.status)) errors.push(`check[${index}].status is invalid`)
    if (check.status === 'FAIL') {
      errors.push(`check[${index}] is FAIL; verification.status cannot be PASS`)
    }
    if (check.status === 'BLOCKED') {
      errors.push(
        `check[${index}] is BLOCKED; verification.status cannot be PASS. Missing local E2E credentials are not a CI Aftercare shortcut.`,
      )
    }
    if (check.status === 'NOT_REQUIRED' && isEmptyText(check.not_required_reason)) {
      errors.push(`check[${index}].NOT_REQUIRED requires not_required_reason`)
    }
    if (
      check.status === 'NOT_REQUIRED' &&
      (check.scope === 'functional_e2e' || check.scope === 'regression_e2e') &&
      isCredentialOmissionReason(check.not_required_reason)
    ) {
      errors.push(
        `check[${index}] missing credentials must be BLOCKED, not NOT_REQUIRED, and CI is not a substitute`,
      )
    }

    if (check.scope === 'full_repository' && check.status === 'PASS') {
      const key = normalizeCheckName(check.name)
      const indexes = fullChecks.get(key) ?? []
      indexes.push(index)
      fullChecks.set(key, indexes)
    }
  }

  const duplicates = [...fullChecks.entries()].filter(([, indexes]) => indexes.length > 1)
  if (duplicates.length > 0 && isEmptyText(evidence.duplicate_full_check_reason)) {
    errors.push(
      `duplicate full checks require duplicate_full_check_reason: ${duplicates.map(([name]) => name).join(', ')}`,
    )
  }

  const browserE2eRequired =
    evidence.browser_e2e_required === true || pathsRequireBrowserE2e(evidence.affected_scope)
  if (browserE2eRequired) {
    const e2eChecks = checks.filter(
      (check) => check !== null && typeof check === 'object' && check.scope === 'functional_e2e',
    )
    if (e2eChecks.length === 0) {
      errors.push(
        'changed user-visible screens require a local functional_e2e check; CI End-to-end is not a substitute',
      )
    } else if (!e2eChecks.some((check) => check.authority === 'local' && check.status === 'PASS')) {
      errors.push(
        'changed user-visible screens require a local functional_e2e PASS; CI End-to-end is not a substitute',
      )
    }
  }

  if (!Array.isArray(evidence.reruns)) {
    errors.push('verification evidence requires reruns to be an array')
  } else {
    for (const [index, rerun] of evidence.reruns.entries()) {
      if (
        isEmptyText(rerun?.check) ||
        isEmptyText(rerun?.reason) ||
        isEmptyText(rerun?.invalidated_by)
      ) {
        errors.push(`rerun[${index}] requires check, reason, and invalidated_by`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

export function evaluateReviewEvidence({ evidence, headSha = '' }) {
  const errors = []
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { ok: false, errors: ['review evidence object is missing'] }
  }

  const required = evidence.required === true
  const status = String(evidence.status ?? '').toUpperCase()

  if (!required) {
    if (status !== 'NOT_REQUIRED')
      errors.push('review.status must be NOT_REQUIRED when review is not required')
    if (isEmptyText(evidence.not_required_reason)) {
      errors.push('review NOT_REQUIRED requires not_required_reason')
    }
    return { ok: errors.length === 0, errors }
  }

  if (status !== 'PASS') errors.push('review.status must be PASS when review is required')
  const revision = evidence.reviewed_revision
  if (revision === null || typeof revision !== 'object') {
    errors.push('reviewed_revision is required')
  } else {
    if (isEmptyText(revision.commit_sha)) errors.push('reviewed_revision.commit_sha is required')
    if (isEmptyText(revision.tree_sha)) errors.push('reviewed_revision.tree_sha is required')
    if (headSha && revision.commit_sha !== headSha) {
      errors.push('reviewed_revision.commit_sha does not match the requested head SHA')
    }
  }

  if (!isNonEmptyList(evidence.reviewers)) {
    errors.push('required review needs at least one independent reviewer')
  } else {
    for (const [index, reviewer] of evidence.reviewers.entries()) {
      if (reviewer?.independence_attested !== true) {
        errors.push(`reviewer[${index}] requires independence_attested=true`)
      }
      if (!isNonEmptyTextList(reviewer?.viewpoints)) {
        errors.push(`reviewer[${index}] requires non-empty viewpoints`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

export function parseLoopEvidenceArguments(args) {
  const options = {
    mode: null,
    file: '',
    evidenceJson: '',
    headSha: '',
    userRequestedCurrentPrApply: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--learning') options.mode = 'learning'
    else if (arg === '--verification') options.mode = 'verification'
    else if (arg === '--review') options.mode = 'review'
    else if (arg === '--file') {
      options.file = next ?? ''
      index += 1
    } else if (arg === '--evidence-json') {
      options.evidenceJson = next ?? ''
      index += 1
    } else if (arg === '--head') {
      options.headSha = next ?? ''
      index += 1
    } else if (arg === '--user-requested-apply') {
      options.userRequestedCurrentPrApply = next === 'true'
      index += 1
    } else {
      throw new Error(`unknown option: ${arg}`)
    }
  }

  if (!options.mode) throw new Error('one of --learning, --verification, or --review is required')
  if (!options.file && !options.evidenceJson)
    throw new Error('--file or --evidence-json is required')
  return options
}

function loadEvidence(options) {
  return options.evidenceJson ? JSON.parse(options.evidenceJson) : readJsonFile(options.file)
}

export function runLoopEvidenceCheck(options) {
  let input
  try {
    input = loadEvidence(options)
  } catch (error) {
    console.log(`LOOP_EVIDENCE ${options.mode}: FAIL`)
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }

  const result =
    options.mode === 'learning'
      ? evaluateLearningApplication({
          userRequestedCurrentPrApply: options.userRequestedCurrentPrApply,
          learning: extractLearningRecord(input),
        })
      : options.mode === 'verification'
        ? evaluateVerificationEvidence({ evidence: input })
        : evaluateReviewEvidence({ evidence: input, headSha: options.headSha })

  console.log(`LOOP_EVIDENCE ${options.mode}: ${result.ok ? 'PASS' : 'FAIL'}`)
  for (const error of result.errors) console.error(`error: ${error}`)
  return result.ok ? 0 : 1
}

function normalizePath(value) {
  return path
    .resolve(value)
    .replace(/[\\/]+$/, '')
    .toLowerCase()
}

const invokedPath = process.argv[1] ? normalizePath(process.argv[1]) : ''
const modulePath = normalizePath(fileURLToPath(import.meta.url))
if (invokedPath === modulePath) {
  try {
    process.exitCode = runLoopEvidenceCheck(parseLoopEvidenceArguments(process.argv.slice(2)))
  } catch (error) {
    console.error('LOOP_EVIDENCE status: FAIL')
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
