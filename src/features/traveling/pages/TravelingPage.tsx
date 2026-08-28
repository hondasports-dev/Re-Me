import { useQuery } from 'convex/react'

import { api } from '../../../../convex/_generated/api'
import { TravelingErrorBoundary } from '../components/TravelingErrorBoundary'
import { TravelingLetterList } from '../components/TravelingLetterList'

export function TravelingPage() {
  return (
    <TravelingErrorBoundary>
      <TravelingList />
    </TravelingErrorBoundary>
  )
}

function TravelingList() {
  const letters = useQuery(api.letters.listTravelingLetters)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return <TravelingLetterList letters={letters} timeZone={timeZone} />
}
