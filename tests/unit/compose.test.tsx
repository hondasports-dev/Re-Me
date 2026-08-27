import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('convex/react', () => ({
  useAction: () => vi.fn().mockResolvedValue(null),
}))

import { DeliverySealForm } from '../../src/features/compose/components/DeliverySealForm'
import { LetterEditor } from '../../src/features/compose/components/LetterEditor'
import { SendRitual } from '../../src/features/compose/components/SendRitual'
import {
  canAdvanceToSend,
  canConfirmSend,
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

  it('enables send only when body, delivery mode, and attachments are ready', () => {
    expect(
      canConfirmSend({
        attachmentsReady: true,
        body: '今の自分へ',
        deliveryMode: null,
        sending: false,
      }),
    ).toBe(false)
    expect(
      canConfirmSend({
        attachmentsReady: false,
        body: '今の自分へ',
        deliveryMode: 'few_days',
        sending: false,
      }),
    ).toBe(false)
    expect(
      canConfirmSend({
        attachmentsReady: true,
        body: '今の自分へ',
        deliveryMode: 'few_days',
        sending: true,
      }),
    ).toBe(false)
    expect(
      canConfirmSend({
        attachmentsReady: true,
        body: '今の自分へ',
        deliveryMode: 'few_days',
        sending: false,
      }),
    ).toBe(true)
  })

  it('summarizes body, delivery, seal, and attachments for confirmation', () => {
    expect(
      sendConfirmationSummary({
        body: '  未来の自分へ  ',
        deliveryMode: 'few_weeks',
        locationLabel: '鴨川',
        photoCount: 2,
        sealed: false,
      }),
    ).toEqual({
      attachmentLabel: '写真 2枚 / 場所「鴨川」',
      bodyPreview: '未来の自分へ',
      deliveryLabel: '数週間後くらい',
      sealLabel: '封をしない',
    })
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
  it('keeps send disabled until a delivery window is chosen, then confirms the letter', async () => {
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

    expect(screen.getByRole('button', { name: '未来へ送る' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: '未来へ送る前の確認' })).toBeVisible()
    expect(screen.getByText('未来の自分へ')).toBeVisible()
    expect(screen.getByText('まだ選んでいません')).toBeVisible()
    expect(screen.getByText('写真 1枚 / 場所「鴨川」')).toBeVisible()

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

    expect(screen.getAllByText('数週間後くらい').length).toBeGreaterThan(1)
    expect(screen.getByRole('radio', { name: /封をしない/ })).toBeChecked()
    expect(screen.getByText('写真 1枚 / 場所「鴨川」')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '未来へ送る' }))
    expect(sendCount).toBe(1)
  })

  it('keeps send disabled while a photo is still pending', () => {
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
    expect(screen.getByText('写真の準備が終わるまでお待ちください。')).toBeVisible()
  })
})

describe('SendRitual', () => {
  it('finishes immediately when motion is reduced', async () => {
    vi.useFakeTimers()
    const onFinished = vi.fn()

    try {
      render(<SendRitual onFinished={onFinished} reducedMotion />)
      expect(screen.getByRole('heading', { name: '手紙は未来へ旅立ちました' })).toBeVisible()
      await vi.advanceTimersByTimeAsync(50)
      expect(onFinished).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
