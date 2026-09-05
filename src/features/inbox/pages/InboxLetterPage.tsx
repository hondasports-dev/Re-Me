import { api, useMutation, useQuery } from '../../../shared/api/react'
import { useState } from 'react'
import { useParams } from 'react-router'

import { InboxErrorBoundary } from '../components/InboxErrorBoundary'
import { InboxLetterDetail } from '../components/InboxLetterDetail'
import { inboxContentQueryArgs } from '../model/inbox'
import { useCalendarClock } from '../model/useCalendarClock'

export function InboxLetterPage() {
  return (
    <InboxErrorBoundary>
      <InboxLetterRoute />
    </InboxErrorBoundary>
  )
}

function InboxLetterRoute() {
  const { letterId } = useParams()
  const typedLetterId = letterId as string | undefined
  const openLetter = useMutation(api.letters.openLetter)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const metadata = useQuery(
    api.letters.getLetterMetadata,
    typedLetterId ? { letterId: typedLetterId } : 'skip',
  )
  const contentArgs = inboxContentQueryArgs(typedLetterId, metadata)
  const content = useQuery(api.letters.getReadableContent, contentArgs)
  const attachments = useQuery(api.attachments.listReadableAttachments, contentArgs)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = useCalendarClock(timeZone)

  return (
    <InboxLetterDetail
      attachments={attachments === null ? [] : attachments}
      content={content}
      metadata={typedLetterId ? metadata : null}
      now={now}
      onOpen={async () => {
        if (!typedLetterId || opening) {
          return
        }

        setOpening(true)
        setOpenError(null)

        try {
          await openLetter({ letterId: typedLetterId })
        } catch {
          setOpenError('手紙を開封できませんでした。もう一度お試しください。')
        } finally {
          setOpening(false)
        }
      }}
      openError={openError}
      opening={opening}
      timeZone={timeZone}
    />
  )
}
