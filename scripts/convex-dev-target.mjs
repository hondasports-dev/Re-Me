import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const convexBin = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/convex/bin/main.js',
)

export function isCloudDevOverrideEnabled(env = process.env) {
  return env.CONVEX_ALLOW_CLOUD_DEV === '1'
}

export function convexSelectLocalArgs() {
  return ['deployment', 'select', 'local']
}

export function convexSelectDevArgs() {
  return ['deployment', 'select', 'dev']
}

export function convexDevArgs(extraArgs = []) {
  return ['dev', ...extraArgs]
}

export function runConvex(
  args,
  {
    env = process.env,
    execFile = execFileSync,
    nodePath = process.execPath,
    bin = convexBin,
    cwd = process.cwd(),
  } = {},
) {
  execFile(nodePath, [bin, ...args], { stdio: 'inherit', env, cwd })
}

export function runConvexDevTarget(extraArgs = [], options = {}) {
  const env = options.env ?? process.env
  if (isCloudDevOverrideEnabled(env)) {
    runConvex(convexSelectDevArgs(), options)
  } else {
    runConvex(convexSelectLocalArgs(), options)
  }
  runConvex(convexDevArgs(extraArgs), options)
}

function normalizePath(value) {
  return path.resolve(value).replaceAll('\\', '/').toLowerCase()
}

function isMainModule() {
  const invokedPath = process.argv[1] ? normalizePath(process.argv[1]) : ''
  return invokedPath === normalizePath(fileURLToPath(import.meta.url))
}

if (isMainModule()) {
  try {
    runConvexDevTarget(process.argv.slice(2))
  } catch {
    process.exitCode = 1
  }
}
