import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { canReplyFromInbox, needsOpenRitual } from '../../inbox/model/inbox'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import { ComposeDraftEditor } from '../components/ComposeDraftEditor'
import { ComposeUnavailableScreen } from '../components/ComposeUnavailableScreen'
import { startReplyDraft } from '../model/compose'

export function ReplyPage() {
  const { letterId } = useParams()
  const parentId = letterId as Id<'letters'> | undefined
  const createDraft = useMutation(api.letters.createDraft)
  const [createdDraftId, setCreatedDraftId] = useState<Id<'letters'> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const creating = useRef(false)
  const parent = useQuery(api.letters.getLetterMetadata, parentId ? { letterId: parentId } : 'skip')
  const candidateDraftId = createdDraftId ?? parent?.nextLetterId ?? null
  const draft = useQuery(
    api.letters.getDraft,
    candidateDraftId ? { letterId: candidateDraftId } : 'skip',
  )

  useEffect(() => {
    if (!parentId || parent === undefined || creating.current || createdDraftId || error) {
      return
    }

    if (parent === null || parent.status !== 'delivered' || needsOpenRitual(parent)) {
      return
    }

    if (parent.repliedAt !== null || parent.nextLetterId) {
      return
    }

    creating.current = true
    void startReplyDraft(parentId, () => createDraft({ parentLetterId: parentId }))
      .then((created) => {
        setCreatedDraftId(created.letterId as Id<'letters'>)
      })
      .catch(() => {
        creating.current = false
        setError('返信の下書きを用意できませんでした。もう一度お試しください。')
      })
  }, [createdDraftId, createDraft, error, parent, parentId])

  if (!parentId) {
    return <ComposeUnavailableScreen sent={false} />
  }

  if (error) {
    return (
      <StatusScreen description={error} title="返信できません" tone="content" variant="error" />
    )
  }

  if (parent === undefined) {
    return (
      <StatusScreen
        description="返信の便箋をひらいています。"
        title="未来へ返信する"
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

  if (needsOpenRitual(parent)) {
    return (
      <StatusScreen
        action={
          <Link className="inbox-letter__back" to={`/letters/${parent.letterId}`}>
            開封する
          </Link>
        }
        description="封をした手紙は、開封してから未来へ返信できます。"
        title="まだ開封していません"
        tone="content"
        variant="error"
      />
    )
  }

  if (parent.repliedAt !== null) {
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

  if (!canReplyFromInbox(parent) && parent.nextLetterId === null) {
    return (
      <StatusScreen
        description="この手紙には返信できません。"
        title="返信できません"
        tone="content"
        variant="error"
      />
    )
  }

  if (draft === undefined || !candidateDraftId) {
    return (
      <StatusScreen
        description="返信の便箋をひらいています。"
        title="未来へ返信する"
        tone="content"
        variant="loading"
      />
    )
  }

  if (draft === null) {
    return <ComposeUnavailableScreen sent={false} />
  }

  return (
    <ComposeDraftEditor
      draft={draft}
      eyebrow="届いた手紙から"
      heading="未来へ返信する"
      letterId={candidateDraftId}
      nextPath={`/letters/${parentId}/reply/send`}
    />
  )
}
