import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import { LetterEditor } from '../components/LetterEditor'
import type { PhotoAttachment } from '../components/PhotoAttachmentList'
import { useAutosaveDraft } from '../hooks/useAutosaveDraft'
import { canAdvanceToSend } from '../model/compose'
import { sanitizePhoto, uploadPhoto } from '../model/photo'

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
  const createAttachmentIntent = useMutation(api.attachments.createAttachmentIntent)
  const finalizeAttachment = useAction(api.attachmentActions.finalizeAttachment)
  const removeDraftPhoto = useMutation(api.attachments.removeDraftPhoto)
  const attachments = useQuery(api.attachments.listReadableAttachments, { letterId })
  const [locationDraft, setLocationDraft] = useState('')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoUploadProgress, setPhotoUploadProgress] = useState<number | null>(null)
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

  const photos: PhotoAttachment[] = (attachments ?? []).flatMap((attachment) =>
    attachment.kind === 'photo' && attachment.generationToken
      ? [
          {
            attachmentId: attachment.attachmentId,
            generationToken: attachment.generationToken,
            status: attachment.status === 'ready' ? 'ready' : 'pending',
          } satisfies PhotoAttachment,
        ]
      : [],
  )

  async function handleAddPhoto(file: File): Promise<void> {
    setPhotoError(null)
    setPhotoUploadProgress(0)
    let intent: {
      attachmentId: Id<'letterAttachments'>
      generationToken: string
      uploadUrl: string
      expiresAt: number
    } | null = null

    try {
      const sanitized = await sanitizePhoto(file)
      intent = await createAttachmentIntent({
        letterId,
        mimeType: 'image/jpeg',
        byteSize: sanitized.blob.size,
        width: sanitized.width,
        height: sanitized.height,
      })
      await uploadPhoto(intent.uploadUrl, sanitized.blob, setPhotoUploadProgress)
      await finalizeAttachment({
        attachmentId: intent.attachmentId,
        generationToken: intent.generationToken,
      })
    } catch (error) {
      if (intent) {
        try {
          await removeDraftPhoto({
            attachmentId: intent.attachmentId,
            generationToken: intent.generationToken,
          })
        } catch {
          // The server reconciliation job owns cleanup if immediate removal fails.
        }
      }
      setPhotoError(error instanceof Error ? error.message : '写真を添えられませんでした。')
    } finally {
      setPhotoUploadProgress(null)
    }
  }

  async function handleRemovePhoto(photo: PhotoAttachment): Promise<void> {
    setPhotoError(null)
    try {
      await removeDraftPhoto({
        attachmentId: photo.attachmentId,
        generationToken: photo.generationToken,
      })
    } catch {
      setPhotoError('写真を外せませんでした。')
    }
  }

  return (
    <>
      {locationError || photoError ? (
        <p className="letter-editor__alert" role="alert">
          {locationError ?? photoError}
        </p>
      ) : null}
      <LetterEditor
        body={body}
        locationDraft={locationDraft}
        locationLabel={draft.locationLabel}
        onAddPhoto={(file) => {
          void handleAddPhoto(file)
        }}
        onBodyChange={setBody}
        onLocationDraftChange={setLocationDraft}
        onNext={() => {
          void handleNext()
        }}
        onRemoveLocation={() => {
          void handleRemoveLocation()
        }}
        onRemovePhoto={(photo) => {
          void handleRemovePhoto(photo)
        }}
        onSaveLocation={() => {
          void handleSaveLocation()
        }}
        saveStatus={saveStatus}
        photos={photos}
        photoUploadProgress={photoUploadProgress}
      />
    </>
  )
}
