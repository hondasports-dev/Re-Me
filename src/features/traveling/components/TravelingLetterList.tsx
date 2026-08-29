import { Link } from 'react-router'

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
    <section aria-labelledby="traveling-title" className="traveling-list">
      <header className="traveling-list__header">
        <p className="traveling-list__eyebrow">未来を旅する手紙</p>
        <h1 id="traveling-title">旅する手紙</h1>
        <p className="traveling-list__copy">届くまでのあいだ、内容を変えずに見守れます。</p>
      </header>
      <ul aria-label="旅する手紙" className="traveling-list__items">
        {letters.map((letter) => {
          const label = travelingListItemLabel(letter, timeZone)
          return (
            <li key={letter.letterId}>
              <Link
                aria-label={label}
                className="traveling-list__item"
                to={`/traveling/${letter.letterId}`}
              >
                <span className="traveling-list__seal">{travelingSealLabel(letter.sealed)}</span>
                <strong>{travelingDeliveryLabel(letter.deliveryMode)}</strong>
                <span>
                  {formatDeliveryWindow(
                    letter.deliveryWindowStart,
                    letter.deliveryWindowEnd,
                    timeZone,
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
