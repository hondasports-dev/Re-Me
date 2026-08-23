import { Button } from '@mantine/core'
import { useAction } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export interface PhotoAttachment {
  attachmentId: Id<'letterAttachments'>
  generationToken: string
  status: 'pending' | 'ready'
}

export function PhotoAttachmentList({
  disabled,
  onRemove,
  photos,
}: {
  disabled: boolean
  onRemove: (photo: PhotoAttachment) => void
  photos: PhotoAttachment[]
}) {
  if (photos.length === 0) {
    return null
  }

  return (
    <ul aria-label="添付した写真" className="letter-editor__photos">
      {photos.map((photo, index) => (
        <PhotoAttachmentItem
          disabled={disabled}
          key={photo.attachmentId}
          label={`添付写真 ${index + 1}`}
          onRemove={() => onRemove(photo)}
          photo={photo}
        />
      ))}
    </ul>
  )
}

function PhotoAttachmentItem({
  disabled,
  label,
  onRemove,
  photo,
}: {
  disabled: boolean
  label: string
  onRemove: () => void
  photo: PhotoAttachment
}) {
  const createDownloadCapability = useAction(api.attachments.createAttachmentDownloadCapability)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (photo.status !== 'ready') {
      return
    }

    let active = true
    const refresh = async () => {
      const capability = await createDownloadCapability({
        attachmentId: photo.attachmentId,
        generationToken: photo.generationToken,
      })
      if (active) {
        setUrl(capability?.url ?? null)
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 45_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [createDownloadCapability, photo.attachmentId, photo.generationToken, photo.status])

  return (
    <li className="letter-editor__photo">
      {url ? (
        <img alt={label} src={url} />
      ) : (
        <div aria-label={`${label}を処理中`} className="letter-editor__photo-placeholder">
          準備中
        </div>
      )}
      <Button
        disabled={disabled}
        onClick={onRemove}
        size="compact-xs"
        type="button"
        variant="subtle"
      >
        外す
      </Button>
    </li>
  )
}
