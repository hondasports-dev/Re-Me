import { api, useQuery } from '../../../shared/api/react'
import { useParams } from 'react-router'

import { StatusScreen } from '../../../shared/components/StatusScreen'
import { ComposeDraftEditor } from '../components/ComposeDraftEditor'
import { ComposeUnavailableScreen } from '../components/ComposeUnavailableScreen'

export function ComposeEditorPage() {
  const { letterId } = useParams()
  const typedLetterId = letterId as string | undefined
  const draft = useQuery(api.letters.getDraft, typedLetterId ? { letterId: typedLetterId } : 'skip')
  const metadata = useQuery(
    api.letters.getLetterMetadata,
    typedLetterId && draft === null ? { letterId: typedLetterId } : 'skip',
  )

  if (!typedLetterId) {
    return <ComposeUnavailableScreen sent={false} />
  }

  if (draft === undefined) {
    return (
      <StatusScreen
        description="便箋をひらいています。"
        title="手紙を書く"
        tone="content"
        variant="loading"
      />
    )
  }

  if (draft === null) {
    if (metadata === undefined) {
      return (
        <StatusScreen
          description="便箋をひらいています。"
          title="手紙を書く"
          tone="content"
          variant="loading"
        />
      )
    }

    return (
      <ComposeUnavailableScreen
        sent={metadata?.status === 'traveling' || metadata?.status === 'delivered'}
      />
    )
  }

  return (
    <ComposeDraftEditor
      draft={draft}
      letterId={typedLetterId}
      nextPath={`/write/${letterId}/send`}
    />
  )
}
