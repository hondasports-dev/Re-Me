import { api, useAction } from '../api/react'
import { useEffect, useState } from 'react'

const REFRESH_MS = 45_000

export function useAttachmentDownloadUrl(
  attachmentId: string,
  generationToken: string,
): string | null {
  const createDownloadCapability = useAction(api.attachments.createAttachmentDownloadCapability)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let requestId = 0
    const refresh = async () => {
      const currentRequestId = ++requestId
      try {
        const capability = await createDownloadCapability({
          attachmentId,
          generationToken,
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
    const timer = window.setInterval(() => void refresh(), REFRESH_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [attachmentId, createDownloadCapability, generationToken])

  return url
}
