import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const E2E_AUTH0_KEYS = ['E2E_AUTH0_EMAIL', 'E2E_AUTH0_PASSWORD', 'E2E_AUTH0_CONNECTION']
export const REQUIRED_E2E_AUTH0_KEYS = ['E2E_AUTH0_EMAIL', 'E2E_AUTH0_PASSWORD']

function isEmptyText(value) {
  return typeof value !== 'string' || value.trim() === ''
}

function normalizePath(value) {
  return path
    .resolve(value)
    .replace(/[\\/]+$/, '')
    .toLowerCase()
}

export function parseDotEnv(text) {
  const values = new Map()
  const rawLines = new Map()
  if (!text) return { values, rawLines }

  for (const originalLine of text.split(/\r?\n/)) {
    const line = originalLine.replace(/^\uFEFF/, '')
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const stripped = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed
    const eq = stripped.indexOf('=')
    if (eq <= 0) continue
    const key = stripped.slice(0, eq).trim()
    let value = stripped.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    values.set(key, value)
    rawLines.set(key, line)
  }

  return { values, rawLines }
}

export function planE2eAuth0Sync({ currentText = '', sourceText = '' } = {}) {
  const current = parseDotEnv(currentText)
  const source = parseDotEnv(sourceText)
  const copied = []
  const alreadyPresent = []
  const missingInSource = []
  const linesToAppend = []

  for (const key of E2E_AUTH0_KEYS) {
    const currentValue = current.values.get(key)
    const sourceValue = source.values.get(key)
    if (!isEmptyText(currentValue)) {
      alreadyPresent.push(key)
      continue
    }
    if (isEmptyText(sourceValue)) {
      if (REQUIRED_E2E_AUTH0_KEYS.includes(key)) missingInSource.push(key)
      continue
    }
    copied.push(key)
    linesToAppend.push(source.rawLines.get(key) ?? `${key}=${sourceValue}`)
  }

  let nextText = currentText
  if (linesToAppend.length > 0) {
    if (nextText && !nextText.endsWith('\n')) nextText += '\n'
    nextText += `${linesToAppend.join('\n')}\n`
  }

  return {
    copied,
    alreadyPresent,
    missingInSource,
    nextText,
    wrote: copied.length > 0,
  }
}

export function formatE2eEnvReport(plan) {
  const parts = []
  if (plan.copied.length > 0) parts.push(`copied ${plan.copied.join(', ')} from canonical`)
  if (plan.alreadyPresent.length > 0)
    parts.push(`already present ${plan.alreadyPresent.join(', ')}`)
  if (plan.missingInSource.length > 0) {
    parts.push(`canonical missing ${plan.missingInSource.join(', ')}`)
  }
  return parts.join('; ') || 'no E2E_AUTH0 keys found'
}

export function hasRequiredE2eAuth0Values(values) {
  return REQUIRED_E2E_AUTH0_KEYS.every((key) => !isEmptyText(values?.get?.(key)))
}

export function syncWorktreeE2eEnv({
  currentPath,
  canonicalPath,
  exists = existsSync,
  readFile = readFileSync,
  writeFile = writeFileSync,
} = {}) {
  if (!currentPath || !canonicalPath) {
    return {
      copied: [],
      alreadyPresent: [],
      missingInSource: [...REQUIRED_E2E_AUTH0_KEYS],
      nextText: '',
      wrote: false,
    }
  }

  const canonicalEnvPath = path.join(canonicalPath, '.env.local')
  const currentEnvPath = path.join(currentPath, '.env.local')
  const sourceText = exists(canonicalEnvPath) ? readFile(canonicalEnvPath, 'utf8') : ''
  const currentText =
    normalizePath(currentPath) === normalizePath(canonicalPath)
      ? sourceText
      : exists(currentEnvPath)
        ? readFile(currentEnvPath, 'utf8')
        : ''
  const plan = planE2eAuth0Sync({ currentText, sourceText })

  if (plan.wrote && normalizePath(currentPath) !== normalizePath(canonicalPath)) {
    writeFile(currentEnvPath, plan.nextText, 'utf8')
  }

  return plan
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

export function runE2eEnvSync({ cwd = process.cwd() } = {}) {
  const currentPath = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
  }).trim()
  const entries = parseWorktreeList(
    execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd, encoding: 'utf8' }),
  )
  const canonicalPath = entries[0]?.path || ''
  const plan = syncWorktreeE2eEnv({ currentPath, canonicalPath })
  console.log(`E2E_ENV: ${formatE2eEnvReport(plan)}`)
  return 0
}

const invokedPath = process.argv[1] ? normalizePath(process.argv[1]) : ''
const modulePath = normalizePath(fileURLToPath(import.meta.url))
if (invokedPath === modulePath) {
  try {
    process.exitCode = runE2eEnvSync()
  } catch (error) {
    console.error('E2E_ENV status: FAIL')
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
