import { Button, FileButton, Progress, TextInput } from '@mantine/core'

import { canAdvanceToSend } from '../model/compose'
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTOS_PER_LETTER } from '../model/photo'
import { PhotoAttachmentList, type PhotoAttachment } from './PhotoAttachmentList'

interface LetterEditorProps {
  body: string
  eyebrow?: string
  heading?: string
  locationDraft: string
  locationLabel: string | null
  onAddPhoto: (file: File) => void
  onBodyChange: (body: string) => void
  onLocationDraftChange: (value: string) => void
  onNext: () => void
  onRemoveLocation: () => void
  onRemovePhoto: (photo: PhotoAttachment) => void
  onSaveLocation: () => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  photos: PhotoAttachment[]
  photoUploadProgress: number | null
}

export function LetterEditor({
  body,
  eyebrow = '今の自分から',
  heading = '手紙を書く',
  locationDraft,
  locationLabel,
  onAddPhoto,
  onBodyChange,
  onLocationDraftChange,
  onNext,
  onRemoveLocation,
  onRemovePhoto,
  onSaveLocation,
  saveStatus,
  photos,
  photoUploadProgress,
}: LetterEditorProps) {
  const photosReady =
    photoUploadProgress === null && photos.every((photo) => photo.status === 'ready')
  const canNext = canAdvanceToSend(body) && photosReady

  return (
    <section aria-label={heading} className="letter-editor" data-eyebrow={eyebrow}>
      <p className="visually-hidden" aria-live="polite">
        {saveLabel(saveStatus)}
      </p>

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
        <FileButton
          accept={ACCEPTED_PHOTO_TYPES.join(',')}
          disabled={photos.length >= MAX_PHOTOS_PER_LETTER || photoUploadProgress !== null}
          onChange={(file) => {
            if (file) onAddPhoto(file)
          }}
        >
          {(props) => (
            <Button {...props} type="button" variant="default">
              写真を添える（{photos.length}/{MAX_PHOTOS_PER_LETTER}）
            </Button>
          )}
        </FileButton>
        {photoUploadProgress === null ? null : (
          <div aria-live="polite">
            <Progress aria-label="写真のアップロード" value={photoUploadProgress} />
            <span className="visually-hidden">{photoUploadProgress}%</span>
          </div>
        )}
        <PhotoAttachmentList
          disabled={photoUploadProgress !== null}
          onRemove={onRemovePhoto}
          photos={photos}
        />

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
        {canAdvanceToSend(body) ? null : <p>本文を書いてから、届ける時期へ進める。</p>}
        {photosReady ? null : <p>写真の準備が終わるまでお待ちください。</p>}
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
