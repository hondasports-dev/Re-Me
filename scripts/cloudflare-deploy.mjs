import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const target = process.argv[2] ?? ''
if (target !== 'preview' && target !== 'production') {
  console.error('Cloudflare deploy target must be preview or production')
  process.exitCode = 1
} else {
  const domain = process.env.AUTH0_DOMAIN?.trim()
  const audience = process.env.AUTH0_AUDIENCE?.trim()
  if (!domain || !audience) {
    console.error('AUTH0_DOMAIN and AUTH0_AUDIENCE are required for Cloudflare deploy')
    process.exitCode = 1
  } else {
    const environment = { ...process.env, CLOUDFLARE_ENV: target }
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js')
    const database = target === 'preview' ? 're-me-preview' : 're-me'
    const migration = spawnSync(
      process.execPath,
      [wrangler, 'd1', 'migrations', 'apply', database, '--remote', '--env', target],
      { env: environment, stdio: 'inherit' },
    )
    if (migration.error || migration.status !== 0) {
      if (migration.error) console.error(migration.error.message)
      process.exitCode = migration.status ?? 1
    } else {
      const deploy = spawnSync(
        process.execPath,
        [
          wrangler,
          'deploy',
          '--env',
          target,
          '--var',
          `AUTH0_DOMAIN:${domain}`,
          '--var',
          `AUTH0_AUDIENCE:${audience}`,
        ],
        { env: environment, stdio: 'inherit' },
      )
      if (deploy.error) console.error(deploy.error.message)
      process.exitCode = deploy.status ?? 1
    }
  }
}
