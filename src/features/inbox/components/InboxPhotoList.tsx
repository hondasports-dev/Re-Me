import { useAction } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export function InboxPhotoList({
  photos,
}: {
  photos: Array<{
    attachmentId: string
    generationToken: string
  }>
}) {
  if (photos.length === 0) {
    return null
  }

  return (
    <ul aria-label="添付した写真" className="inbox-letter__photos">
      {photos.map((photo, index) => (
        <InboxPhotoItem key={photo.attachmentId} label={`添付写真 ${index + 1}`} photo={photo} />
      ))}
    </ul>
  )
}

function InboxPhotoItem({
  label,
  photo,
}: {
  label: string
  photo: {
    attachmentId: string
    generationToken: string
  }
}) {
  const createDownloadCapability = useAction(api.attachments.createAttachmentDownloadCapability)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let requestId = 0
    const refresh = async () => {
      const currentRequestId = ++requestId
      try {
        const capability = await createDownloadCapability({
          attachmentId: photo.attachmentId as Id<'letterAttachments'>,
          generationToken: photo.generationToken,
        })
        if (active && currentRequestId === requestId) {
          setUrl(capability?.url ?? null)
        }
      } catch {
        if (active && currentRequestId === requestId) {
          setUrl(null)
        }
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 45_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [createDownloadCapability, photo.attachmentId, photo.generationToken])

  return (
    <li className="inbox-letter__photo">
      {url ? (
        <img alt={label} src={url} />
      ) : (
        <div aria-label={`${label}を読み込み中`} className="inbox-letter__photo-placeholder">
          準備中
        </div>
      )}
    </li>
  )
}
