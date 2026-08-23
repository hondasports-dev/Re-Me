import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useAutosaveDraft } from '../../src/features/compose/hooks/useAutosaveDraft'

describe('useAutosaveDraft', () => {
  it('hydrates the saved body after the draft query arrives', () => {
    const { result, rerender } = renderHook(
      ({ savedBody }: { savedBody: string | undefined }) =>
        useAutosaveDraft(savedBody, async () => undefined),
      { initialProps: { savedBody: undefined as string | undefined } },
    )

    expect(result.current.body).toBe('')

    rerender({ savedBody: '未来の自分へ、今日の気持ちを残す。' })

    expect(result.current.body).toBe('未来の自分へ、今日の気持ちを残す。')
  })

  it('keeps in-progress typing instead of overwriting it with a later save', () => {
    const { result, rerender } = renderHook(
      ({ savedBody }: { savedBody: string }) => useAutosaveDraft(savedBody, async () => undefined),
      { initialProps: { savedBody: '昨日の自分へ' } },
    )

    act(() => {
      result.current.setBody('未来の自分へ')
    })
    rerender({ savedBody: '昨日の自分へ' })

    expect(result.current.body).toBe('未来の自分へ')
  })

  it('hydrates a saved body that arrives after an empty query frame', () => {
    const { result, rerender } = renderHook(
      ({ savedBody }: { savedBody: string | undefined }) =>
        useAutosaveDraft(savedBody, async () => undefined),
      { initialProps: { savedBody: undefined as string | undefined } },
    )

    rerender({ savedBody: '' })
    rerender({ savedBody: '保存済みの本文' })

    expect(result.current.body).toBe('保存済みの本文')
  })
})
