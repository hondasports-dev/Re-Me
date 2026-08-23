import { Button, TextInput } from '@mantine/core'

import { canAdvanceToSend } from '../model/compose'

interface LetterEditorProps {
  body: string
  locationDraft: string
  locationLabel: string | null
  onBodyChange: (body: string) => void
  onLocationDraftChange: (value: string) => void
  onNext: () => void
  onRemoveLocation: () => void
  onSaveLocation: () => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
}

export function LetterEditor({
  body,
  locationDraft,
  locationLabel,
  onBodyChange,
  onLocationDraftChange,
  onNext,
  onRemoveLocation,
  onSaveLocation,
  saveStatus,
}: LetterEditorProps) {
  const canNext = canAdvanceToSend(body)

  return (
    <section aria-labelledby="compose-title" className="letter-editor">
      <header className="letter-editor__header">
        <p className="letter-editor__eyebrow">今の自分から</p>
        <h1 id="compose-title">手紙を書く</h1>
        <p className="letter-editor__status" aria-live="polite">
          {saveLabel(saveStatus)}
        </p>
      </header>

      <label className="letter-editor__paper">
        <span className="visually-hidden">本文</span>
        <textarea
          aria-label="本文"
          className="letter-editor__body"
          onChange={(event) => {
            onBodyChange(event.currentTarget.value)
          }}
          placeholder="未来の自分へ、今の気持ちを残そう。"
          value={body}
        />
      </label>

      <div className="letter-editor__attachments">
        <Button disabled type="button" variant="default">
          写真（次のステップ）
        </Button>

        {locationLabel ? (
          <div className="letter-editor__location">
            <p>{locationLabel}</p>
            <Button onClick={onRemoveLocation} type="button" variant="subtle">
              場所を外す
            </Button>
          </div>
        ) : (
          <div className="letter-editor__location">
            <TextInput
              aria-label="場所の名前"
              onChange={(event) => {
                onLocationDraftChange(event.currentTarget.value)
              }}
              placeholder="場所の名前（任意）"
              value={locationDraft}
            />
            <Button
              disabled={locationDraft.trim().length === 0}
              onClick={onSaveLocation}
              type="button"
              variant="light"
            >
              場所を残す
            </Button>
          </div>
        )}
      </div>

      <div className="letter-editor__cta">
        <Button disabled={!canNext} onClick={onNext} type="button">
          次へ
        </Button>
        {canNext ? null : <p>本文を書いてから、届ける時期へ進める。</p>}
      </div>
    </section>
  )
}

function saveLabel(status: LetterEditorProps['saveStatus']): string {
  if (status === 'saving') {
    return '保存しています'
  }

  if (status === 'saved') {
    return '下書きを残しました'
  }

  if (status === 'error') {
    return '下書きを保存できませんでした'
  }

  return '入力は自動で残ります'
}
