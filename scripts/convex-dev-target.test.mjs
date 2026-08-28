import { describe, expect, it } from 'vitest'

import {
  convexDevArgs,
  convexSelectLocalArgs,
  isCloudDevOverrideEnabled,
  runConvexDevTarget,
} from './convex-dev-target.mjs'

describe('convex-dev-target', () => {
  it('selects the local deployment before convex dev', () => {
    const calls = []
    runConvexDevTarget(['--once'], {
      env: {},
      execFile: (_node, argv) => {
        calls.push(argv.slice(1))
      },
    })
    expect(calls).toEqual([convexSelectLocalArgs(), convexDevArgs(['--once'])])
  })

  it('skips local select when CONVEX_ALLOW_CLOUD_DEV=1', () => {
    const calls = []
    runConvexDevTarget(['--start', 'vite dev'], {
      env: { CONVEX_ALLOW_CLOUD_DEV: '1' },
      execFile: (_node, argv) => {
        calls.push(argv.slice(1))
      },
    })
    expect(isCloudDevOverrideEnabled({ CONVEX_ALLOW_CLOUD_DEV: '1' })).toBe(true)
    expect(calls).toEqual([convexDevArgs(['--start', 'vite dev'])])
  })
})
