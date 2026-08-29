import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  formatE2eEnvReport,
  hasRequiredE2eAuth0Values,
  parseDotEnv,
  syncWorktreeE2eEnv,
} from './sync-worktree-e2e-env.mjs'

function normalizePath(value) {
  return path
    .resolve(value)
    .replace(/[\\/]+$/, '')
    .toLowerCase()
}

function runGit(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function parseWorktreeList(output) {
  const entries = []
  let entry = null
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (entry) entries.push(entry)
      entry = { path: line.slice('worktree '.length) }
      continue
    }
  }
  if (entry) entries.push(entry)
  return entries
}

export function pathsRequireBrowserE2e(paths) {
  return paths.some((filePath) => {
    const normalized = String(filePath).replaceAll('\\', '/').replace(/^\.\//, '')
    if (normalized.startsWith('e2e/')) return true
    if (normalized.startsWith('src/router/')) return true
    if (normalized.startsWith('src/app/') && normalized.endsWith('.tsx')) return true
    if (normalized.startsWith('src/features/') && /\.(tsx|css)$/.test(normalized)) return true
    if (normalized.startsWith('src/styles/')) return true
    return false
  })
}

export function isCredentialOmissionReason(reason) {
  return /(credential|auth0|e2e_auth0|\.env\.local|password|資格情報|missing env|env missing|no env)/i.test(
    String(reason),
  )
}

export function evaluateLocalE2eGate({ changedFiles, hasEmail, hasPassword }) {
  const required = pathsRequireBrowserE2e(changedFiles)
  if (!required) return { ok: true, required: false, errors: [] }
  if (hasEmail && hasPassword) return { ok: true, required: true, errors: [] }
  return {
    ok: false,
    required: true,
    errors: [
      'local functional E2E is required for the changed screens; E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD are missing after canonical .env.local sync. Treat this as BLOCKED, not NOT_REQUIRED. CI End-to-end is not a substitute.',
    ],
  }
}

export function collectChangedFiles(cwd, baseRef = 'main') {
  let resolvedBase = baseRef
  try {
    runGit(['rev-parse', '--verify', baseRef], cwd)
  } catch {
    resolvedBase = 'origin/main'
  }

  const names = [
    ...runGit(['diff', '--name-only', `${resolvedBase}...HEAD`], cwd).split(/\r?\n/),
    ...runGit(['diff', '--name-only'], cwd).split(/\r?\n/),
    ...runGit(['diff', '--cached', '--name-only'], cwd).split(/\r?\n/),
    ...runGit(['ls-files', '--others', '--exclude-standard'], cwd).split(/\r?\n/),
  ]
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}

function envHasRequiredAuth0({ currentPath, processEnv = process.env }) {
  const envPath = path.join(currentPath, '.env.local')
  const fileValues = existsSync(envPath)
    ? parseDotEnv(readFileSync(envPath, 'utf8')).values
    : new Map()
  const merged = new Map(fileValues)
  for (const key of ['E2E_AUTH0_EMAIL', 'E2E_AUTH0_PASSWORD']) {
    if (typeof processEnv[key] === 'string' && processEnv[key].trim() !== '') {
      merged.set(key, processEnv[key])
    }
  }
  return hasRequiredE2eAuth0Values(merged)
}

export function runLocalE2eGate({ cwd = process.cwd(), baseRef = 'main' } = {}) {
  const currentPath = runGit(['rev-parse', '--show-toplevel'], cwd).trim()
  const entries = parseWorktreeList(runGit(['worktree', 'list', '--porcelain'], cwd))
  const canonicalPath = entries[0]?.path || ''
  const plan = syncWorktreeE2eEnv({ currentPath, canonicalPath })
  console.log(`E2E_ENV: ${formatE2eEnvReport(plan)}`)

  const changedFiles = collectChangedFiles(cwd, baseRef)
  const ready = envHasRequiredAuth0({ currentPath })
  const result = evaluateLocalE2eGate({
    changedFiles,
    hasEmail: ready,
    hasPassword: ready,
  })

  console.log(`LOCAL_E2E_GATE status: ${result.ok ? 'PASS' : 'FAIL'}`)
  console.log(`required: ${result.required ? 'yes' : 'no'}`)
  for (const error of result.errors) console.error(`error: ${error}`)
  return result.ok ? 0 : 1
}

const invokedPath = process.argv[1] ? normalizePath(process.argv[1]) : ''
const modulePath = normalizePath(fileURLToPath(import.meta.url))
if (invokedPath === modulePath) {
  try {
    process.exitCode = runLocalE2eGate()
  } catch (error) {
    console.error('LOCAL_E2E_GATE status: FAIL')
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
