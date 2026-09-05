import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const target = process.argv[2] ?? 'local'
const targets = new Set(['local', 'preview', 'production'])

if (!targets.has(target)) {
  console.error(`unknown Cloudflare build target: ${target}`)
  process.exitCode = 1
} else {
  const environment = { ...process.env }
  if (target === 'local') {
    delete environment.CLOUDFLARE_ENV
  } else {
    environment.CLOUDFLARE_ENV = target
  }

  const mode = target === 'local' ? 'production' : target
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', mode],
    {
      env: environment,
      stdio: 'inherit',
    },
  )

  if (result.error) {
    console.error(result.error.message)
    process.exitCode = 1
  } else if (typeof result.status === 'number') {
    process.exitCode = result.status
  } else {
    process.exitCode = 1
  }
}
