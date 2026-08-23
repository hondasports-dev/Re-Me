import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('convex/react', () => ({
  useAction: () => vi.fn().mockResolvedValue(null),
}))

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
          onAddPhoto={() => undefined}
          onBodyChange={() => undefined}
          onLocationDraftChange={() => undefined}
          onNext={() => {
            nextCount += 1
          }}
          onRemoveLocation={() => undefined}
          onRemovePhoto={() => undefined}
          onSaveLocation={() => undefined}
          saveStatus="idle"
          photos={[]}
          photoUploadProgress={null}
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '写真を添える（0/3）' })).toBeEnabled()

    view.rerender(
      <MantineProvider theme={reMeTheme}>
        <LetterEditor
          body="未来の自分へ"
          locationDraft=""
          locationLabel={null}
          onAddPhoto={() => undefined}
          onBodyChange={() => undefined}
          onLocationDraftChange={() => undefined}
          onNext={() => {
            nextCount += 1
          }}
          onRemoveLocation={() => undefined}
          onRemovePhoto={() => undefined}
          onSaveLocation={() => undefined}
          saveStatus="saved"
          photos={[]}
          photoUploadProgress={null}
        />
      </MantineProvider>,
    )

    await user.click(screen.getByRole('button', { name: '次へ' }))
    expect(nextCount).toBe(1)
  })

  it('keeps next disabled while an attached photo is pending', () => {
    render(
      <MantineProvider theme={reMeTheme}>
        <LetterEditor
          body="未来の自分へ"
          locationDraft=""
          locationLabel={null}
          onAddPhoto={() => undefined}
          onBodyChange={() => undefined}
          onLocationDraftChange={() => undefined}
          onNext={() => undefined}
          onRemoveLocation={() => undefined}
          onRemovePhoto={() => undefined}
          onSaveLocation={() => undefined}
          saveStatus="saved"
          photos={[
            {
              attachmentId: 'attachment-1' as never,
              generationToken: 'generation-1',
              status: 'pending',
            },
          ]}
          photoUploadProgress={null}
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
    expect(screen.getByText('写真の準備が終わるまでお待ちください。')).toBeInTheDocument()
  })
})
