import { api, useAction, useMutation, useQuery } from '../../../shared/api/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useAutosaveDraft } from '../hooks/useAutosaveDraft'
import { canAdvanceToSend } from '../model/compose'
import { sanitizePhoto, uploadPhoto } from '../model/photo'
import { LetterEditor } from './LetterEditor'
import type { PhotoAttachment } from './PhotoAttachmentList'

export function ComposeDraftEditor({
  draft,
  eyebrow,
  heading,
  letterId,
  nextPath,
}: {
  draft: {
    body: string
    locationLabel: string | null
  }
  eyebrow?: string
  heading?: string
  letterId: string
  nextPath: string
}) {
  const navigate = useNavigate()
  const saveDraft = useMutation(api.letters.saveDraft)
  const setDraftLocation = useMutation(api.attachments.setDraftLocation)
  const removeDraftLocation = useMutation(api.attachments.removeDraftLocation)
  const createAttachmentIntent = useMutation(api.attachments.createAttachmentIntent)
  const finalizeAttachment = useAction(api.attachments.finalizeAttachment)
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
      void navigate(nextPath)
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
      attachmentId: string
      generationToken: string
      uploadUrl: string
      expiresAt: number
    } | null = null

    try {
      const sanitized = await sanitizePhoto(file)
      const createdIntent = await createAttachmentIntent({
        letterId,
        mimeType: 'image/jpeg',
        byteSize: sanitized.blob.size,
        width: sanitized.width,
        height: sanitized.height,
      })
      intent = createdIntent
      await uploadPhoto(createdIntent.uploadUrl, sanitized.blob, setPhotoUploadProgress)
      await finalizeAttachment({
        attachmentId: createdIntent.attachmentId,
        generationToken: createdIntent.generationToken,
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
        eyebrow={eyebrow}
        heading={heading}
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
