import { useQuery } from 'convex/react'
import { Link, useParams } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useCalendarClock } from '../../inbox/model/useCalendarClock'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import { ThreadErrorBoundary } from '../components/ThreadErrorBoundary'
import { ThreadTimeline } from '../components/ThreadTimeline'

export function ThreadPage() {
  return (
    <ThreadErrorBoundary>
      <ThreadRoute />
    </ThreadErrorBoundary>
  )
}

function ThreadRoute() {
  const { threadId } = useParams()
  const typedThreadId = threadId as Id<'threads'> | undefined
  const thread = useQuery(
    api.threads.getThread,
    typedThreadId ? { threadId: typedThreadId } : 'skip',
  )
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = useCalendarClock(timeZone)

  if (!typedThreadId) {
    return (
      <StatusScreen
        description="このスレッドは見つかりません。"
        title="手紙が見つかりません"
        tone="content"
        variant="error"
      />
    )
  }

  if (thread === undefined) {
    return (
      <StatusScreen
        description="時間をまたいだ手紙をたどっています。"
        title="時間をまたぐ手紙"
        tone="content"
        variant="loading"
      />
    )
  }

  if (thread === null) {
    return (
      <StatusScreen
        description="このスレッドは見つからないか、すでに削除されています。"
        title="手紙が見つかりません"
        tone="content"
        variant="error"
      />
    )
  }

  if (thread.letters.length === 0) {
    return (
      <StatusScreen
        action={
          <Link className="inbox-letter__back" to="/">
            届いた手紙へ戻る
          </Link>
        }
        description="まだ未来へ送った手紙が、この糸にはありません。"
        title="時間をまたぐ手紙"
        tone="content"
        variant="empty"
      />
    )
  }

  return (
    <section aria-label="時間をまたぐ手紙" className="thread-page">
      <header className="thread-page__header">
        <p className="thread-page__eyebrow">一本道の手紙</p>
        <p className="thread-page__copy">
          過去の自分から、次の未来の自分へ。返信は枝分かれしません。
        </p>
      </header>
      <ThreadTimeline letters={thread.letters} now={now} timeZone={timeZone} />
      <Link className="inbox-letter__back" to="/">
        届いた手紙へ戻る
      </Link>
    </section>
  )
}
