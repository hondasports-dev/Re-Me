import { Button } from '@mantine/core'
import type { ReactNode } from 'react'

import {
  canConfirmSend,
  deliveryModeOptions,
  sendConfirmationSummary,
  type DeliveryMode,
} from '../model/compose'

interface DeliverySealFormProps {
  body: string
  deliveryMode: DeliveryMode | null
  locationLabel: string | null
  onDeliveryModeChange: (mode: DeliveryMode) => void
  onSealedChange: (sealed: boolean) => void
  onSend: () => void
  photoCount: number
  photosPending: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  sealed: boolean
  sendError: string | null
  sending: boolean
}

export function DeliverySealForm({
  body,
  deliveryMode,
  locationLabel,
  onDeliveryModeChange,
  onSealedChange,
  onSend,
  photoCount,
  photosPending,
  saveStatus,
  sealed,
  sendError,
  sending,
}: DeliverySealFormProps) {
  const canSend = canConfirmSend({
    attachmentsReady: !photosPending,
    body,
    deliveryMode,
    sending,
  })
  const summary = sendConfirmationSummary({
    body,
    deliveryMode,
    locationLabel,
    photoCount,
    sealed,
  })

  return (
    <section aria-labelledby="send-title" className="delivery-seal">
      <p className="letter-editor__eyebrow">未来へ届ける前に</p>
      <h1 id="send-title">届ける時期と封</h1>
      <p className="delivery-seal__copy">時期と封を選んで、送る前に内容を確かめる。</p>
      <p className="letter-editor__status" aria-live="polite">
        {saveStatus === 'saving'
          ? '保存しています'
          : saveStatus === 'error'
            ? '設定を保存できませんでした'
            : saveStatus === 'saved'
              ? '下書きに残しました'
              : '選んだ内容は自動で残ります'}
      </p>

      <fieldset className="delivery-seal__fieldset">
        <legend>届ける時期</legend>
        {deliveryModeOptions.map((option) => (
          <label className="delivery-seal__option" key={option.value}>
            <input
              checked={deliveryMode === option.value}
              disabled={sending}
              name="deliveryMode"
              onChange={() => {
                onDeliveryModeChange(option.value)
              }}
              type="radio"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="delivery-seal__fieldset">
        <legend>封</legend>
        <label className="delivery-seal__option">
          <input
            checked={sealed}
            disabled={sending}
            name="sealed"
            onChange={() => {
              onSealedChange(true)
            }}
            type="radio"
          />
          <span>
            封をする
            <small>届くまで、あなたも読むことができません。</small>
          </span>
        </label>
        <label className="delivery-seal__option">
          <input
            checked={!sealed}
            disabled={sending}
            name="sealed"
            onChange={() => {
              onSealedChange(false)
            }}
            type="radio"
          />
          <span>
            封をしない
            <small>送ったあとも、いつでも読み返せます。</small>
          </span>
        </label>
      </fieldset>

      <section aria-labelledby="send-confirm-title" className="delivery-seal__confirm">
        <h2 id="send-confirm-title">未来へ送る前の確認</h2>
        <p className="delivery-seal__preview">{summary.bodyPreview || '本文がまだありません。'}</p>
        <dl className="delivery-seal__summary">
          <div>
            <dt>届ける時期</dt>
            <dd>{summary.deliveryLabel}</dd>
          </div>
          <div>
            <dt>封</dt>
            <dd>{summary.sealLabel}</dd>
          </div>
          <div>
            <dt>添付</dt>
            <dd>{summary.attachmentLabel}</dd>
          </div>
        </dl>
      </section>

      {sendError ? (
        <p className="letter-editor__alert" role="alert">
          {sendError}
        </p>
      ) : null}

      <div className="letter-editor__cta">
        <Button disabled={!canSend} loading={sending} onClick={onSend} type="button">
          未来へ送る
        </Button>
        {canAdvanceHint(body, deliveryMode, photosPending)}
      </div>
    </section>
  )
}

function canAdvanceHint(
  body: string,
  deliveryMode: DeliveryMode | null,
  photosPending: boolean,
): ReactNode {
  if (photosPending) {
    return <p>写真の準備が終わるまでお待ちください。</p>
  }

  if (body.trim().length === 0) {
    return <p>本文を書いてから送れます。</p>
  }

  if (!deliveryMode) {
    return <p>届ける時期を選ぶと、未来へ送れます。</p>
  }

  return null
}
