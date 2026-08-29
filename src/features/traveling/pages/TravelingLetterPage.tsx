import { Button } from '@mantine/core'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { TravelingErrorBoundary } from '../components/TravelingErrorBoundary'
import { TravelingLetterDetail } from '../components/TravelingLetterDetail'
import { travelingContentQueryArgs } from '../model/traveling'

export function TravelingLetterPage() {
  return (
    <TravelingErrorBoundary>
      <TravelingLetterRoute />
    </TravelingErrorBoundary>
  )
}

function TravelingLetterRoute() {
  const { letterId } = useParams()
  const typedLetterId = letterId as Id<'letters'> | undefined
  const navigate = useNavigate()
  const deleteLetter = useMutation(api.letters.deleteLetter)
  const metadata = useQuery(
    api.letters.getLetterMetadata,
    typedLetterId ? { letterId: typedLetterId } : 'skip',
  )
  const contentArgs = travelingContentQueryArgs(typedLetterId, metadata)
  const content = useQuery(api.letters.getReadableContent, contentArgs)
  const attachments = useQuery(api.attachments.listReadableAttachments, contentArgs)

  return (
    <>
      <TravelingLetterDetail
        attachments={attachments === null ? [] : attachments}
        content={content}
        metadata={typedLetterId ? metadata : null}
        onDelete={async () => {
          if (!typedLetterId) {
            return
          }

          await deleteLetter({ letterId: typedLetterId })
          void navigate('/traveling', { replace: true })
        }}
        timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
      />
      {import.meta.env.VITE_ALLOW_E2E_DB_LOGIN === '1' && typedLetterId ? (
        <E2EForceDeliverButton letterId={typedLetterId} />
      ) : null}
    </>
  )
}

function E2EForceDeliverButton({ letterId }: { letterId: Id<'letters'> }) {
  const forceDeliver = useMutation(api.letters.forceDeliverOwnLetter)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      disabled={busy}
      onClick={() => {
        void (async () => {
          setBusy(true)
          try {
            await forceDeliver({ letterId })
            void navigate(`/letters/${letterId}`, { replace: true })
          } catch {
            setBusy(false)
          }
        })()
      }}
      type="button"
      variant="subtle"
    >
      E2E: 今すぐ届ける
    </Button>
  )
}
