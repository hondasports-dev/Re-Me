import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import { LetterEditor } from '../components/LetterEditor'
import { useAutosaveDraft } from '../hooks/useAutosaveDraft'
import { canAdvanceToSend } from '../model/compose'

export function ComposeEditorPage() {
  const { letterId } = useParams()
  const typedLetterId = letterId as Id<'letters'> | undefined
  const draft = useQuery(api.letters.getDraft, typedLetterId ? { letterId: typedLetterId } : 'skip')

  if (!typedLetterId || draft === null) {
    return (
      <StatusScreen
        description="この下書きは開けないか、もう送れない手紙です。"
        title="手紙が見つかりません"
        tone="content"
        variant="error"
      />
    )
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

  return <LoadedComposeEditor draft={draft} letterId={typedLetterId} />
}

function LoadedComposeEditor({
  draft,
  letterId,
}: {
  draft: {
    body: string
    locationLabel: string | null
  }
  letterId: Id<'letters'>
}) {
  const navigate = useNavigate()
  const saveDraft = useMutation(api.letters.saveDraft)
  const setDraftLocation = useMutation(api.attachments.setDraftLocation)
  const removeDraftLocation = useMutation(api.attachments.removeDraftLocation)
  const [locationDraft, setLocationDraft] = useState('')
  const [locationError, setLocationError] = useState<string | null>(null)
  const { body, flush, saveStatus, setBody } = useAutosaveDraft(draft.body, async (nextBody) => {
    await saveDraft({ letterId, body: nextBody })
  })

  async function handleNext(): Promise<void> {
    if (!canAdvanceToSend(body)) {
      return
    }

    try {
      await flush()
      void navigate(`/write/${letterId}/send`)
    } catch {
      setLocationError('下書きを保存してから進めてください。')
    }
  }

  async function handleSaveLocation(): Promise<void> {
    setLocationError(null)

    try {
      await setDraftLocation({ letterId, locationLabel: locationDraft })
      setLocationDraft('')
    } catch {
      setLocationError('場所の名前を残できませんでした。')
    }
  }

  async function handleRemoveLocation(): Promise<void> {
    setLocationError(null)

    try {
      await removeDraftLocation({ letterId })
    } catch {
      setLocationError('場所を外せませんでした。')
    }
  }

  return (
    <>
      {locationError ? (
        <p className="letter-editor__alert" role="alert">
          {locationError}
        </p>
      ) : null}
      <LetterEditor
        body={body}
        locationDraft={locationDraft}
        locationLabel={draft.locationLabel}
        onBodyChange={setBody}
        onLocationDraftChange={setLocationDraft}
        onNext={() => {
          void handleNext()
        }}
        onRemoveLocation={() => {
          void handleRemoveLocation()
        }}
        onSaveLocation={() => {
          void handleSaveLocation()
        }}
        saveStatus={saveStatus}
      />
    </>
  )
}
