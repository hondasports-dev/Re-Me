import { Link } from 'react-router'

import { NavIcon } from '../../../app/BottomNav'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import {
  formatDeliveryWindow,
  travelingDeliveryLabel,
  travelingListItemLabel,
  travelingListPhase,
  travelingSealLabel,
  type TravelingLetterMetadata,
} from '../model/traveling'

export function TravelingLetterList({
  letters,
  timeZone,
}: {
  letters: TravelingLetterMetadata[] | undefined
  timeZone: string
}) {
  const phase = travelingListPhase(letters)

  if (phase === 'loading' || letters === undefined) {
    return (
      <StatusScreen
        description="未来へ向かっている手紙を確認しています。"
        title="旅する手紙"
        tone="content"
        variant="loading"
      />
    )
  }

  if (phase === 'empty') {
    return (
      <StatusScreen
        description="未来へ向かっている手紙は、まだありません。"
        title="旅する手紙"
        tone="content"
        variant="empty"
      />
    )
  }

  return (
    <section aria-label="旅する手紙" className="traveling-list">
      <div className="traveling-list__tabs">
        <span
          aria-hidden="true"
          className="traveling-list__tab traveling-list__tab--active"
          data-label="送信済み"
        />
        <span aria-hidden="true" className="traveling-list__tab" data-label="下書き" />
      </div>
      <ul aria-label="旅する手紙" className="traveling-list__items">
        {letters.map((letter, index) => {
          const label = travelingListItemLabel(letter, timeZone)
          return (
            <li key={letter.letterId}>
              <Link
                aria-label={label}
                className="traveling-list__item"
                to={`/traveling/${letter.letterId}`}
              >
                <span aria-hidden="true" className="traveling-list__item-art">
                  <img
                    alt=""
                    src={index === 0 ? '/images/re-me-paper-plane.png' : '/images/re-me-planet.png'}
                  />
                </span>
                <span className="traveling-list__item-content">
                  <span className="traveling-list__seal">
                    {index === 0
                      ? 'あなたの手紙が未来へ旅立ちました'
                      : travelingSealLabel(letter.sealed)}
                  </span>
                  <strong>未来のわたしへ</strong>
                  <span className="traveling-list__item-delivery">
                    <span>{travelingDeliveryLabel(letter.deliveryMode)}</span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      {formatDeliveryWindow(
                        letter.deliveryWindowStart,
                        letter.deliveryWindowEnd,
                        timeZone,
                      )}
                    </span>
                  </span>
                </span>
                {letter.sealed ? <NavIcon className="traveling-list__lock" name="lock" /> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
