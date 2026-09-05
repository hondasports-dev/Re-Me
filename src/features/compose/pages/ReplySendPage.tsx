import { api, useQuery } from '../../../shared/api/react'
import { useRef } from 'react'
import { Link, useParams } from 'react-router'

import { StatusScreen } from '../../../shared/components/StatusScreen'
import { ComposeUnavailableScreen } from '../components/ComposeUnavailableScreen'
import { ComposeSendSession } from './ComposeSendPage'

export function ReplySendPage() {
  const { letterId } = useParams()
  const parentId = letterId as string | undefined
  const parent = useQuery(api.letters.getLetterMetadata, parentId ? { letterId: parentId } : 'skip')
  const draftId = parent?.nextLetterId ?? null
  const draft = useQuery(api.letters.getDraft, draftId ? { letterId: draftId } : 'skip')
  const sendSessionStarted = useRef(false)

  if (draft) {
    sendSessionStarted.current = true
  }

  if (!parentId) {
    return <ComposeUnavailableScreen sent={false} />
  }

  if (parent === undefined) {
    return (
      <StatusScreen
        description="届ける準備をしています。"
        title="届ける時期と封"
        tone="content"
        variant="loading"
      />
    )
  }

  if (parent === null || parent.status !== 'delivered') {
    return (
      <StatusScreen
        description="この手紙には返信できません。"
        title="返信できません"
        tone="content"
        variant="error"
      />
    )
  }

  if (parent.repliedAt !== null && draft === null && !sendSessionStarted.current) {
    return (
      <StatusScreen
        action={
          <Link className="inbox-letter__back" to={`/threads/${parent.threadId}`}>
            時間をまたぐ手紙を見る
          </Link>
        }
        description="この手紙への返信は、すでに未来へ送っています。"
        title="返信済みです"
        tone="content"
        variant="error"
      />
    )
  }

  if (!draftId) {
    return <ComposeUnavailableScreen sent={false} />
  }

  return <ComposeSendSession letterId={draftId} />
}
