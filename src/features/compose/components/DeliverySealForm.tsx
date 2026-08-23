import { Button } from '@mantine/core'

import { deliveryModeOptions, type DeliveryMode } from '../model/compose'

interface DeliverySealFormProps {
  deliveryMode: DeliveryMode | null
  onDeliveryModeChange: (mode: DeliveryMode) => void
  onSealedChange: (sealed: boolean) => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  sealed: boolean
}

export function DeliverySealForm({
  deliveryMode,
  onDeliveryModeChange,
  onSealedChange,
  saveStatus,
  sealed,
}: DeliverySealFormProps) {
  return (
    <section aria-labelledby="send-title" className="delivery-seal">
      <p className="letter-editor__eyebrow">未来へ届ける前に</p>
      <h1 id="send-title">届ける時期と封</h1>
      <p className="delivery-seal__copy">
        送信の儀式は次のステップ。時期と封は、いま下書きに残す。
      </p>
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

      <Button disabled type="button">
        未来へ送る
      </Button>
    </section>
  )
}
