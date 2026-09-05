import { MantineProvider } from '@mantine/core'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/shared/api/react', async () => {
  const actual = await vi.importActual<typeof import('../../src/shared/api/react')>(
    '../../src/shared/api/react',
  )
  return { ...actual, useAction: () => vi.fn().mockResolvedValue(null) }
})

import { DeliverySealForm } from '../../src/features/compose/components/DeliverySealForm'
import { LetterEditor } from '../../src/features/compose/components/LetterEditor'
import { SendRitual } from '../../src/features/compose/components/SendRitual'
import {
  canAdvanceToSend,
  canConfirmSend,
  composeSendPhase,
  flushSettingsThenSend,
  isLetterNotADraftError,
  resetBlankDraftInflight,
  sendConfirmationSummary,
  startBlankDraft,
} from '../../src/features/compose/model/compose'
import { reMeTheme } from '../../src/styles/theme'

describe('compose model', () => {
  it('blocks send confirmation until the body has text', () => {
    expect(canAdvanceToSend('   ')).toBe(false)
    expect(canAdvanceToSend('今の自分へ')).toBe(true)
  })

  it('blocks the send CTA until body, delivery mode, and attachments are ready', () => {
    expect(
      canConfirmSend({
        attachmentsReady: true,
        body: '未来の自分へ',
        deliveryMode: null,
        sending: false,
      }),
    ).toBe(false)
    expect(
      canConfirmSend({
        attachmentsReady: false,
        body: '未来の自分へ',
        deliveryMode: 'few_days',
        sending: false,
      }),
    ).toBe(false)
    expect(
      canConfirmSend({
        attachmentsReady: true,
        body: '未来の自分へ',
        deliveryMode: 'few_days',
        sending: true,
      }),
    ).toBe(false)
    expect(
      canConfirmSend({
        attachmentsReady: true,
        body: '未来の自分へ',
        deliveryMode: 'few_days',
        sending: false,
      }),
    ).toBe(true)
  })

  it('summarizes body, delivery, seal, and attachments for confirmation', () => {
    expect(
      sendConfirmationSummary({
        body: '  今の気持ち  ',
        deliveryMode: 'few_weeks',
        locationLabel: '鴨川',
        photoCount: 2,
        sealed: true,
      }),
    ).toEqual({
      attachmentLabel: '写真 2枚 / 場所「鴨川」',
      bodyPreview: '今の気持ち',
      deliveryLabel: '数週間後くらい',
      sealLabel: '封をする',
    })
  })

  it('keeps the send ritual mounted after success even if getDraft is already null', () => {
    expect(
      composeSendPhase({
        draft: null,
        hasLetterId: true,
        sending: false,
        sent: true,
        snapshot: null,
      }),
    ).toBe('ritual')
    expect(
      composeSendPhase({
        draft: null,
        hasLetterId: true,
        sending: false,
        sent: false,
        snapshot: { body: '未来の自分へ' },
      }),
    ).toBe('form')
  })

  it('treats a not-a-draft error as an idempotent send retry signal', async () => {
    expect(isLetterNotADraftError(new Error('letter is not a draft'))).toBe(true)
    expect(isLetterNotADraftError(new Error('attachments are not ready'))).toBe(false)

    let sent = 0
    await flushSettingsThenSend({
      saveSettings: async () => {
        throw new Error('letter is not a draft')
      },
      sendLetter: async () => {
        sent += 1
      },
    })
    expect(sent).toBe(1)

    await expect(
      flushSettingsThenSend({
        saveSettings: async () => {
          throw new Error('attachments are not ready')
        },
        sendLetter: async () => {
          sent += 1
        },
      }),
    ).rejects.toThrow(/attachments are not ready/)
    expect(sent).toBe(1)
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

describe('DeliverySealForm', () => {
  it('shows the confirmation summary and enables send after a delivery mode is chosen', async () => {
    const user = userEvent.setup()
    let sendCount = 0
    const view = render(
      <MantineProvider theme={reMeTheme}>
        <DeliverySealForm
          body="未来の自分へ"
          deliveryMode={null}
          locationLabel="鴨川"
          onDeliveryModeChange={() => undefined}
          onSealedChange={() => undefined}
          onSend={() => {
            sendCount += 1
          }}
          photoCount={1}
          photosPending={false}
          saveStatus="idle"
          sealed
          sendError={null}
          sending={false}
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { name: '未来へ送る前の確認' })).toBeInTheDocument()
    const confirm = screen.getByRole('heading', { name: '未来へ送る前の確認' }).closest('section')
    expect(confirm).not.toBeNull()
    expect(within(confirm!).getByText('未来の自分へ')).toBeInTheDocument()
    expect(within(confirm!).getByText('まだ選んでいません')).toBeInTheDocument()
    expect(within(confirm!).getByText('封をする')).toBeInTheDocument()
    expect(within(confirm!).getByText('写真 1枚 / 場所「鴨川」')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '未来へ送る' })).toBeDisabled()

    view.rerender(
      <MantineProvider theme={reMeTheme}>
        <DeliverySealForm
          body="未来の自分へ"
          deliveryMode="few_weeks"
          locationLabel="鴨川"
          onDeliveryModeChange={() => undefined}
          onSealedChange={() => undefined}
          onSend={() => {
            sendCount += 1
          }}
          photoCount={1}
          photosPending={false}
          saveStatus="saved"
          sealed={false}
          sendError={null}
          sending={false}
        />
      </MantineProvider>,
    )

    const updatedConfirm = screen
      .getByRole('heading', { name: '未来へ送る前の確認' })
      .closest('section')
    expect(within(updatedConfirm!).getByText('数週間後くらい')).toBeInTheDocument()
    expect(within(updatedConfirm!).getByText('封をしない')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '未来へ送る' }))
    expect(sendCount).toBe(1)
  })

  it('freezes delivery and seal radios while sending', () => {
    render(
      <MantineProvider theme={reMeTheme}>
        <DeliverySealForm
          body="未来の自分へ"
          deliveryMode="few_days"
          locationLabel={null}
          onDeliveryModeChange={() => undefined}
          onSealedChange={() => undefined}
          onSend={() => undefined}
          photoCount={0}
          photosPending={false}
          saveStatus="saved"
          sealed
          sendError={null}
          sending
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: '未来へ送る' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: '数日後くらい' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /封をする/ })).toBeDisabled()
  })

  it('keeps send disabled while attachments are not ready', () => {
    render(
      <MantineProvider theme={reMeTheme}>
        <DeliverySealForm
          body="未来の自分へ"
          deliveryMode="few_days"
          locationLabel={null}
          onDeliveryModeChange={() => undefined}
          onSealedChange={() => undefined}
          onSend={() => undefined}
          photoCount={0}
          photosPending
          saveStatus="saved"
          sealed
          sendError={null}
          sending={false}
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('button', { name: '未来へ送る' })).toBeDisabled()
    expect(screen.getByText('写真の準備が終わるまでお待ちください。')).toBeInTheDocument()
  })
})

describe('SendRitual', () => {
  it('finishes immediately when reduced motion is requested', () => {
    vi.useFakeTimers()
    let finished = 0

    try {
      render(
        <SendRitual
          onFinished={() => {
            finished += 1
          }}
          reducedMotion
        />,
      )

      expect(screen.getByRole('heading', { name: '手紙は未来へ旅立ちました' })).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(finished).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
