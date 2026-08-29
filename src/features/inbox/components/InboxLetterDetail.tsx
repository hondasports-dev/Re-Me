import { Button } from '@mantine/core'
import { Link } from 'react-router'

import { StatusScreen } from '../../../shared/components/StatusScreen'
import {
  arrivedTodayLabel,
  canReplyFromInbox,
  fromYouLabel,
  needsOpenRitual,
  type InboxLetterMetadata,
} from '../model/inbox'
import { InboxPhotoList } from './InboxPhotoList'

export type InboxAttachmentView = {
  attachmentId: string
  kind: 'photo' | 'location'
  status: 'pending' | 'ready' | 'deleting'
  generationToken: string | null
  locationLabel: string | null
}

export function InboxLetterDetail({
  attachments,
  content,
  metadata,
  now,
  onOpen,
  openError,
  opening,
  timeZone,
}: {
  attachments: InboxAttachmentView[] | undefined
  content: { body: string } | null | undefined
  metadata: InboxLetterMetadata | null | undefined
  now: number
  onOpen: () => Promise<void>
  openError: string | null
  opening: boolean
  timeZone: string
}) {
  if (metadata === undefined) {
    return (
      <StatusScreen
        description="届いた手紙をひらいています。"
        title="届いた手紙"
        tone="content"
        variant="loading"
      />
    )
  }

  if (metadata === null || metadata.status !== 'delivered') {
    return (
      <StatusScreen
        description="この手紙はまだ届いていないか、すでに削除されています。"
        title="手紙が見つかりません"
        tone="content"
        variant="error"
      />
    )
  }

  if (needsOpenRitual(metadata)) {
    return (
      <article aria-labelledby="inbox-open-title" className="inbox-letter">
        <p className="inbox-letter__eyebrow">封をした手紙</p>
        <h1 id="inbox-open-title">開封する</h1>
        <p className="inbox-letter__copy">
          封をした手紙が、あなたのもとに届いています。本文は、開封するまで見えません。
        </p>
        {openError ? (
          <p className="inbox-letter__alert" role="alert">
            {openError}
          </p>
        ) : null}
        <div className="inbox-letter__open-actions">
          <Button disabled={opening} onClick={() => void onOpen()} type="button">
            開封する
          </Button>
          <Link className="inbox-letter__back" to="/">
            あとで開封する
          </Link>
        </div>
      </article>
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
  const arrived = arrivedTodayLabel(metadata.deliveredAt, now, timeZone)
  const heading = fromYouLabel(metadata.sentAt, now, timeZone)

  return (
    <article aria-labelledby="inbox-letter-title" className="inbox-letter">
      <p className="inbox-letter__eyebrow">届いた手紙</p>
      <h1 id="inbox-letter-title">{heading}</h1>
      {arrived ? <p className="inbox-letter__arrived">{arrived}</p> : null}
      {content === undefined || attachments === undefined ? (
        <p className="inbox-letter__copy">便箋をひらいています。</p>
      ) : (
        <>
          <p className="inbox-letter__body">{content?.body ?? ''}</p>
          {location?.locationLabel ? (
            <p className="inbox-letter__location">場所「{location.locationLabel}」</p>
          ) : null}
          <InboxPhotoList photos={photos} />
        </>
      )}
      <div className="inbox-letter__actions">
        {canReplyFromInbox(metadata) ? (
          <Link className="inbox-letter__reply" to={`/letters/${metadata.letterId}/reply`}>
            未来へ返信する
          </Link>
        ) : null}
        {metadata.threadId ? (
          <Link className="inbox-letter__thread" to={`/threads/${metadata.threadId}`}>
            時間をまたぐ手紙
          </Link>
        ) : null}
        <Link className="inbox-letter__back" to="/">
          届いた手紙へ戻る
        </Link>
      </div>
    </article>
  )
}
