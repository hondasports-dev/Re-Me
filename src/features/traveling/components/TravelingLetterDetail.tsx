import { Button } from '@mantine/core'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { StatusScreen } from '../../../shared/components/StatusScreen'
import {
  formatDeliveryWindow,
  travelingDeliveryLabel,
  travelingSealLabel,
  type TravelingDeliveryMode,
} from '../model/traveling'
import { TravelingPhotoList } from './TravelingPhotoList'

export type TravelingLetterViewModel = {
  letterId: string
  sealed: boolean
  deliveryMode: TravelingDeliveryMode | null
  deliveryWindowStart: number | null
  deliveryWindowEnd: number | null
  status: 'draft' | 'traveling' | 'delivered'
}

export type TravelingAttachmentView = {
  attachmentId: string
  kind: 'photo' | 'location'
  status: 'pending' | 'ready' | 'deleting'
  generationToken: string | null
  locationLabel: string | null
}

/** Renders a traveling letter's delivery status and readable content when allowed. */
export function TravelingLetterDetail({
  attachments,
  content,
  e2eAction,
  metadata,
  onDelete,
  timeZone,
}: {
  attachments: TravelingAttachmentView[] | undefined
  content: { body: string } | null | undefined
  e2eAction?: ReactNode
  metadata: TravelingLetterViewModel | null | undefined
  onDelete: () => Promise<void>
  timeZone: string
}) {
  if (metadata === undefined) {
    return (
      <StatusScreen
        description="旅の途中の手紙をひらいています。"
        title="旅する手紙"
        tone="content"
        variant="loading"
      />
    )
  }

  if (metadata === null || metadata.status !== 'traveling') {
    return (
      <StatusScreen
        description="この手紙は旅の途中にないか、すでに削除されています。"
        title="手紙が見つかりません"
        tone="content"
        variant="error"
      />
    )
  }

  const photos = (attachments ?? [])
    .filter(
      (attachment) =>
        attachment.kind === 'photo' &&
        attachment.status === 'ready' &&
        attachment.generationToken !== null,
    )
    .map((attachment) => ({
      attachmentId: attachment.attachmentId,
      generationToken: attachment.generationToken as string,
    }))
  const location = (attachments ?? []).find(
    (attachment) => attachment.kind === 'location' && attachment.status !== 'deleting',
  )

  return (
    <article
      aria-labelledby="traveling-letter-title"
      className={`traveling-letter${metadata.sealed ? ' traveling-letter--sealed' : ''}`}
    >
      <p className="traveling-letter__eyebrow">未来を旅する手紙</p>
      <h1 id="traveling-letter-title">{travelingSealLabel(metadata.sealed)}</h1>
      {e2eAction}
      <dl className="traveling-letter__summary">
        <div>
          <dt>届ける時期</dt>
          <dd>{travelingDeliveryLabel(metadata.deliveryMode)}</dd>
        </div>
        <div>
          <dt>届くころ</dt>
          <dd>
            {formatDeliveryWindow(
              metadata.deliveryWindowStart,
              metadata.deliveryWindowEnd,
              timeZone,
            )}
          </dd>
        </div>
      </dl>
      {metadata.sealed ? (
        <p className="traveling-letter__sealed">届くまで、あなたも読むことができません。</p>
      ) : content === undefined || attachments === undefined ? (
        <p className="traveling-letter__copy">便箋をひらいています。</p>
      ) : (
        <>
          <p className="traveling-letter__body">{content?.body ?? ''}</p>
          {location?.locationLabel ? (
            <p className="traveling-letter__location">場所「{location.locationLabel}」</p>
          ) : null}
          <TravelingPhotoList photos={photos} />
        </>
      )}
      <DeleteTravelingLetter onDelete={onDelete} />
      <Link className="traveling-letter__back" to="/traveling">
        旅する手紙へ戻る
      </Link>
    </article>
  )
}

/** Provides the confirmation and error handling controls for deleting a letter. */
function DeleteTravelingLetter({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const didOpenConfirmRef = useRef(false)

  useEffect(() => {
    if (confirming) {
      didOpenConfirmRef.current = true
      confirmButtonRef.current?.focus()
      return
    }

    if (didOpenConfirmRef.current) {
      deleteTriggerRef.current?.focus()
    }
  }, [confirming])

  async function confirmDelete(): Promise<void> {
    if (deleting) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await onDelete()
    } catch {
      setError('手紙を削除できませんでした。もう一度お試しください。')
      setDeleting(false)
    }
  }

  if (!confirming) {
    return (
      <Button
        className="traveling-letter__delete"
        onClick={() => setConfirming(true)}
        ref={deleteTriggerRef}
        type="button"
        variant="subtle"
      >
        この手紙を削除する
      </Button>
    )
  }

  return (
    <div
      aria-describedby="traveling-delete-copy"
      aria-labelledby="traveling-delete-title"
      className="traveling-letter__confirm"
      role="alertdialog"
    >
      <h2 id="traveling-delete-title">この手紙を削除しますか</h2>
      <p id="traveling-delete-copy">旅の途中の手紙は、未来へ届かなくなります。</p>
      {error ? (
        <p className="traveling-letter__alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="traveling-letter__confirm-actions">
        <Button
          disabled={deleting}
          onClick={() => void confirmDelete()}
          ref={confirmButtonRef}
          type="button"
        >
          削除する
        </Button>
        <Button
          disabled={deleting}
          onClick={() => setConfirming(false)}
          type="button"
          variant="default"
        >
          やめる
        </Button>
      </div>
    </div>
  )
}
