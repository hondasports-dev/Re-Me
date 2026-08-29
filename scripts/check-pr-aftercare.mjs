import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REQUIRED_CI_CHECK_NAMES = ['Quality gates', 'End-to-end']

function normalizeCheckName(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ')
}

function isEmptyText(value) {
  return typeof value !== 'string' || value.trim() === ''
}

export function checkBucket(check) {
  const bucket = String(check?.bucket ?? '').toLowerCase()
  if (bucket) return bucket
  const state = String(check?.state ?? '').toUpperCase()
  if (state === 'SUCCESS') return 'pass'
  if (
    state === 'FAILURE' ||
    state === 'CANCELLED' ||
    state === 'TIMED_OUT' ||
    state === 'ACTION_REQUIRED'
  ) {
    return 'fail'
  }
  if (state === 'SKIPPED' || state === 'NEUTRAL') return 'skipping'
  return 'pending'
}

export function formatUnresolvedThread(thread) {
  const author = isEmptyText(thread?.author) ? 'unknown' : thread.author
  const filePath = isEmptyText(thread?.path) ? '(no path)' : thread.path
  return `${author} on ${filePath}`
}

export function evaluateAftercareEvidence({
  userStopAtPrCreated = false,
  requiredCheckNames = REQUIRED_CI_CHECK_NAMES,
  checks = [],
  reviewThreads = [],
  reviewDecision = '',
  mergeable = '',
  mergeStateStatus = '',
} = {}) {
  if (userStopAtPrCreated) {
    return { ok: true, status: 'NOT_REQUIRED', errors: [] }
  }

  const errors = []
  const requiredKeys = new Set(requiredCheckNames.map((name) => normalizeCheckName(name)))
  const byName = new Map()
  for (const check of checks) {
    if (check === null || typeof check !== 'object' || isEmptyText(check.name)) continue
    byName.set(normalizeCheckName(check.name), check)
  }

  for (const name of requiredCheckNames) {
    const check = byName.get(normalizeCheckName(name))
    if (!check) {
      errors.push(`required CI check missing: ${name}`)
      continue
    }
    const bucket = checkBucket(check)
    if (bucket !== 'pass') {
      errors.push(`required CI check is not SUCCESS: ${name} (${bucket})`)
    }
  }

  for (const check of checks) {
    if (check === null || typeof check !== 'object' || isEmptyText(check.name)) continue
    if (requiredKeys.has(normalizeCheckName(check.name))) continue
    const bucket = checkBucket(check)
    if (bucket === 'pending') {
      errors.push(`CI check is still pending: ${check.name}`)
    } else if (bucket === 'fail') {
      errors.push(`CI check failed: ${check.name}`)
    }
  }

  for (const thread of reviewThreads) {
    if (thread === null || typeof thread !== 'object') continue
    if (thread.isResolved === true) continue
    errors.push(`unresolved review thread: ${formatUnresolvedThread(thread)}`)
  }

  if (String(reviewDecision).toUpperCase() === 'CHANGES_REQUESTED') {
    errors.push('review decision is CHANGES_REQUESTED')
  }

  const mergeState = String(mergeStateStatus).toUpperCase()
  if (mergeState === 'DIRTY' || String(mergeable).toUpperCase() === 'CONFLICTING') {
    errors.push('PR has merge conflicts')
  }

  return {
    ok: errors.length === 0,
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    errors,
  }
}

function ghJson(args, cwd) {
  return JSON.parse(execFileSync('gh', args, { cwd, encoding: 'utf8' }))
}

function flattenReviewThreads(nodes) {
  return nodes.map((node) => {
    const comment = node?.comments?.nodes?.[0]
    return {
      isResolved: node?.isResolved === true,
      path: node?.path ?? '',
      author: comment?.author?.login ?? 'unknown',
      url: comment?.url ?? '',
    }
  })
}

const THREADS_QUERY =
  'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){pageInfo{hasNextPage endCursor}nodes{isResolved path comments(first:1){nodes{author{login}url}}}}}}}'

function fetchReviewThreads({ cwd, owner, repo, number }) {
  const threads = []
  let cursor = null
  for (;;) {
    const args = [
      'api',
      'graphql',
      '-f',
      `query=${THREADS_QUERY}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${repo}`,
      '-F',
      `number=${number}`,
    ]
    if (cursor) args.push('-F', `cursor=${cursor}`)
    const payload = ghJson(args, cwd)
    const connection = payload?.data?.repository?.pullRequest?.reviewThreads
    threads.push(...flattenReviewThreads(connection?.nodes ?? []))
    if (!connection?.pageInfo?.hasNextPage) break
    cursor = connection.pageInfo.endCursor
    if (isEmptyText(cursor)) break
  }
  return threads
}

export function fetchAftercareSnapshot({ cwd = process.cwd(), pr = '' } = {}) {
  const selector = isEmptyText(pr) ? [] : [String(pr)]
  const view = ghJson(
    [
      'pr',
      'view',
      ...selector,
      '--json',
      'number,url,headRefOid,reviewDecision,mergeable,mergeStateStatus',
    ],
    cwd,
  )
  const { nameWithOwner } = ghJson(['repo', 'view', '--json', 'nameWithOwner'], cwd)
  const [owner, repo] = String(nameWithOwner).split('/')
  const checks = ghJson(['pr', 'checks', String(view.number), '--json', 'name,state,bucket'], cwd)
  const reviewThreads = fetchReviewThreads({
    cwd,
    owner,
    repo,
    number: view.number,
  })
  return {
    number: view.number,
    url: view.url,
    headRefOid: view.headRefOid,
    reviewDecision: view.reviewDecision ?? '',
    mergeable: view.mergeable ?? '',
    mergeStateStatus: view.mergeStateStatus ?? '',
    checks: Array.isArray(checks) ? checks : [],
    reviewThreads,
  }
}

export function parseAftercareArguments(args) {
  const options = { pr: '', file: '', userStopAtPrCreated: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--pr') {
      options.pr = next ?? ''
      index += 1
    } else if (arg === '--file') {
      options.file = next ?? ''
      index += 1
    } else if (arg === '--user-stop-at-pr-created') {
      options.userStopAtPrCreated = true
    } else {
      throw new Error(`unknown option: ${arg}`)
    }
  }
  return options
}

function loadSnapshot(options) {
  if (options.file) return JSON.parse(readFileSync(options.file, 'utf8'))
  return fetchAftercareSnapshot({ pr: options.pr })
}

export function runAftercareCheck(options) {
  if (options.userStopAtPrCreated) {
    const result = evaluateAftercareEvidence({ userStopAtPrCreated: true })
    console.log(`PR_AFTERCARE status: ${result.status}`)
    return 0
  }

  let snapshot
  try {
    snapshot = loadSnapshot(options)
  } catch (error) {
    console.log('PR_AFTERCARE status: FAIL')
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }

  const result = evaluateAftercareEvidence({
    userStopAtPrCreated: snapshot.userStopAtPrCreated === true,
    checks: snapshot.checks,
    reviewThreads: snapshot.reviewThreads,
    reviewDecision: snapshot.reviewDecision,
    mergeable: snapshot.mergeable,
    mergeStateStatus: snapshot.mergeStateStatus,
  })

  console.log(`PR_AFTERCARE status: ${result.status}`)
  if (snapshot.number) console.log(`pr: ${snapshot.number}`)
  if (snapshot.headRefOid) console.log(`head: ${snapshot.headRefOid}`)
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
    process.exitCode = runAftercareCheck(parseAftercareArguments(process.argv.slice(2)))
  } catch (error) {
    console.error('PR_AFTERCARE status: FAIL')
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
