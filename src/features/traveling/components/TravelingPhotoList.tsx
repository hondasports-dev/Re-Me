import { useAttachmentDownloadUrl } from '../../../shared/hooks/useAttachmentDownloadUrl'

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
  const url = useAttachmentDownloadUrl(photo.attachmentId, photo.generationToken)

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
