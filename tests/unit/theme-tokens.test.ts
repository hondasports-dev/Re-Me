import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MantineTheme } from '@mantine/core'
import { describe, expect, it } from 'vitest'

import { reMeCssVariablesResolver, reMeTheme } from '../../src/styles/theme'

const stylesDir = path.dirname(fileURLToPath(import.meta.url))
const tokens = readFileSync(path.resolve(stylesDir, '../../src/styles/tokens.css'), 'utf8')
const motion = readFileSync(path.resolve(stylesDir, '../../src/styles/motion.css'), 'utf8')

describe('design tokens', () => {
  it('keeps color, type, space, radius, shadow, motion, and safe-area tokens in CSS', () => {
    expect(tokens).toContain('--re-me-color-ink:')
    expect(tokens).toContain('--re-me-color-paper:')
    expect(tokens).toContain('--re-me-color-mist:')
    expect(tokens).toContain('--re-me-color-sky:')
    expect(tokens).toContain('--re-me-font-sans:')
    expect(tokens).toContain('--re-me-font-serif:')
    expect(tokens).toContain('--re-me-space-4:')
    expect(tokens).toContain('--re-me-radius-panel:')
    expect(tokens).toContain('--re-me-shadow-soft:')
    expect(tokens).toContain('--re-me-motion-duration-standard:')
    expect(tokens).toContain('--re-me-safe-top:')
    expect(tokens).toContain('--re-me-safe-bottom:')
    expect(tokens).toContain('prefers-reduced-motion: reduce')
    expect(motion).toContain('prefers-reduced-motion: reduce')
  })

  it('connects the Mantine theme to Re:Me tokens', () => {
    expect(reMeTheme.fontFamily).toBe('var(--re-me-font-sans)')
    expect(reMeTheme.headings?.fontFamily).toBe('var(--re-me-font-serif)')
    expect(reMeTheme.primaryColor).toBe('sky')
    expect(reMeTheme.radius?.xl).toBe('var(--re-me-radius-xl)')
    expect(reMeTheme.spacing?.md).toBe('var(--re-me-space-4)')
    expect(reMeTheme.shadows?.lg).toBe('var(--re-me-shadow-soft)')

    const variables = reMeCssVariablesResolver({} as MantineTheme).variables
    expect(variables['--mantine-color-body']).toBe('var(--re-me-color-mist)')
    expect(variables['--mantine-color-text']).toBe('var(--re-me-color-ink)')
  })
})
