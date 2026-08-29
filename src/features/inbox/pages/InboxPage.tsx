import { useQuery } from 'convex/react'

import { api } from '../../../../convex/_generated/api'
import { InboxErrorBoundary } from '../components/InboxErrorBoundary'
import { InboxLetterList } from '../components/InboxLetterList'
import { useCalendarClock } from '../model/useCalendarClock'

export function InboxPage() {
  return (
    <InboxErrorBoundary>
      <InboxList />
    </InboxErrorBoundary>
  )
}

function InboxList() {
  const letters = useQuery(api.letters.listDeliveredLetters)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = useCalendarClock(timeZone)

  return <InboxLetterList letters={letters} now={now} timeZone={timeZone} />
}
