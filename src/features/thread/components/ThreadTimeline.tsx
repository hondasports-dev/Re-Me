import { Link } from 'react-router'

import {
  threadSegmentBody,
  threadSegmentHref,
  threadSegmentLabel,
  type ThreadSegmentView,
} from '../model/thread'

export function ThreadTimeline({
  letters,
  now,
  timeZone,
}: {
  letters: ThreadSegmentView[]
  now: number
  timeZone: string
}) {
  return (
    <ol className="thread-timeline">
      {letters.map((segment) => {
        const href = threadSegmentHref(segment)
        const body = threadSegmentBody(segment)
        const heading = threadSegmentLabel(segment, now, timeZone)

        return (
          <li className="thread-timeline__item" key={segment.letterId}>
            <article
              aria-labelledby={`thread-letter-${segment.letterId}`}
              className="thread-timeline__card"
              data-deleted={segment.deleted ? 'true' : 'false'}
            >
              <p className="thread-timeline__eyebrow">
                {segment.deleted
                  ? '削除された手紙'
                  : segment.status === 'traveling'
                    ? '旅の途中'
                    : '届いた手紙'}
              </p>
              <h2 id={`thread-letter-${segment.letterId}`}>{heading}</h2>
              {body ? <p className="thread-timeline__body">{body}</p> : null}
              {segment.locationLabel ? (
                <p className="thread-timeline__location">場所「{segment.locationLabel}」</p>
              ) : null}
              {href ? (
                <Link className="thread-timeline__open" to={href}>
                  この手紙をひらく
                </Link>
              ) : null}
            </article>
          </li>
        )
      })}
    </ol>
  )
}
