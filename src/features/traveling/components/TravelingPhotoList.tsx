import { useAction } from 'convex/react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export function TravelingPhotoList({
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
    <ul aria-label="添付した写真" className="traveling-letter__photos">
      {photos.map((photo, index) => (
        <TravelingPhotoItem
          key={photo.attachmentId}
          label={`添付写真 ${index + 1}`}
          photo={photo}
        />
      ))}
    </ul>
  )
}

function TravelingPhotoItem({
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
    const refresh = async () => {
      const capability = await createDownloadCapability({
        attachmentId: photo.attachmentId as Id<'letterAttachments'>,
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
  }, [createDownloadCapability, photo.attachmentId, photo.generationToken])

  return (
    <li className="traveling-letter__photo">
      {url ? (
        <img alt={label} src={url} />
      ) : (
        <div aria-label={`${label}を読み込み中`} className="traveling-letter__photo-placeholder">
          準備中
        </div>
      )}
    </li>
  )
}
