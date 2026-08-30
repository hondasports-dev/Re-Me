import { Button } from '@mantine/core'
import { Link, useNavigate } from 'react-router'

import { NavIcon } from '../../../app/BottomNav'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import {
  arrivedTodayLabel,
  fromYouLabel,
  inboxListItemLabel,
  inboxListPhase,
  inboxOpenLabel,
  type InboxLetterMetadata,
} from '../model/inbox'

/** Renders the inbox metadata list while keeping letter contents private. */
export function InboxLetterList({
  letters,
  now,
  timeZone,
}: {
  letters: InboxLetterMetadata[] | undefined
  now: number
  timeZone: string
}) {
  const navigate = useNavigate()
  const phase = inboxListPhase(letters)

  if (phase === 'loading' || letters === undefined) {
    return (
      <StatusScreen
        description="あなた宛ての手紙を確認しています。"
        title="届いた手紙"
        tone="content"
        variant="loading"
      />
    )
  }

  if (phase === 'empty') {
    return (
      <StatusScreen
        action={
          <Button
            onClick={() => {
              void navigate('/write')
            }}
            type="button"
            variant="light"
          >
            手紙を書く
          </Button>
        }
        description="まだ、あなた宛ての手紙は届いていません。今の気持ちを書いて、未来の自分へ届けよう。"
        title="届いた手紙"
        tone="content"
        variant="empty"
      />
    )
  }

  return (
    <section aria-labelledby="inbox-title" className="inbox-list">
      <header className="inbox-list__header">
        <p className="inbox-list__eyebrow">未来のあなたから</p>
        <h1 id="inbox-title">届いた手紙</h1>
        <p className="inbox-list__copy">本文は開くまで見えません。</p>
      </header>
      <div className="inbox-list__tabs">
        <span
          aria-hidden="true"
          className="inbox-list__tab inbox-list__tab--active"
          data-label="未開封"
        />
        <span aria-hidden="true" className="inbox-list__tab" data-label="開封済み" />
      </div>
      <ul aria-label="届いた手紙" className="inbox-list__items">
        {letters.map((letter) => {
          const arrived = arrivedTodayLabel(letter.deliveredAt, now, timeZone)
          const label = inboxListItemLabel(letter, now, timeZone)
          return (
            <li key={letter.letterId}>
              <Link
                aria-label={label}
                className="inbox-list__item"
                to={`/letters/${letter.letterId}`}
              >
                <NavIcon className="inbox-list__item-icon" name="inbox" />
                <span className="inbox-list__item-content">
                  <span className="inbox-list__item-meta">
                    <span className="inbox-list__state">
                      {inboxOpenLabel(letter.sealed, letter.openedAt)}
                    </span>
                    {letter.openedAt === null ? (
                      <span aria-label="未開封" className="inbox-list__unread-dot" />
                    ) : null}
                  </span>
                  <strong>{fromYouLabel(letter.sentAt, now, timeZone)}</strong>
                  {arrived ? <span className="inbox-list__item-arrived">{arrived}</span> : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
