import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LetterEditor } from '../../src/features/compose/components/LetterEditor'
import {
  canAdvanceToSend,
  resetBlankDraftInflight,
  startBlankDraft,
} from '../../src/features/compose/model/compose'
import { reMeTheme } from '../../src/styles/theme'

describe('compose model', () => {
  it('blocks send confirmation until the body has text', () => {
    expect(canAdvanceToSend('   ')).toBe(false)
    expect(canAdvanceToSend('今の自分へ')).toBe(true)
  })

  it('reuses an in-flight blank draft create', async () => {
    resetBlankDraftInflight()
    let calls = 0
    const create = async () => {
      calls += 1
      return { letterId: 'letter-1', threadId: 'thread-1' }
    }

    const [first, second] = await Promise.all([startBlankDraft(create), startBlankDraft(create)])

    expect(calls).toBe(1)
    expect(first).toEqual(second)
    resetBlankDraftInflight()
  })
})

describe('LetterEditor', () => {
  it('keeps next disabled until the letter has a body and then advances', async () => {
    const user = userEvent.setup()
    let nextCount = 0
    const view = render(
      <MantineProvider theme={reMeTheme}>
        <LetterEditor
          body=""
          locationDraft=""
          locationLabel={null}
          onBodyChange={() => undefined}
          onLocationDraftChange={() => undefined}
          onNext={() => {
            nextCount += 1
          }}
          onRemoveLocation={() => undefined}
          onSaveLocation={() => undefined}
          saveStatus="idle"
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '写真（次のステップ）' })).toBeDisabled()

    view.rerender(
      <MantineProvider theme={reMeTheme}>
        <LetterEditor
          body="未来の自分へ"
          locationDraft=""
          locationLabel={null}
          onBodyChange={() => undefined}
          onLocationDraftChange={() => undefined}
          onNext={() => {
            nextCount += 1
          }}
          onRemoveLocation={() => undefined}
          onSaveLocation={() => undefined}
          saveStatus="saved"
        />
      </MantineProvider>,
    )

    await user.click(screen.getByRole('button', { name: '次へ' }))
    expect(nextCount).toBe(1)
  })
})
