export const MAX_INPUT_PHOTO_BYTES = 10 * 1024 * 1024
export const MAX_SANITIZED_PHOTO_BYTES = 5 * 1024 * 1024
export const MAX_PHOTO_DIMENSION = 4096
export const MAX_PHOTOS_PER_LETTER = 3
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export interface SanitizedPhoto {
  blob: Blob
  width: number
  height: number
}

export async function sanitizePhoto(file: File): Promise<SanitizedPhoto> {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
    throw new Error('JPEG・PNG・WebP の写真を選んでください。')
  }
  if (file.size > MAX_INPUT_PHOTO_BYTES) {
    throw new Error('元の写真は10MB以下にしてください。')
  }

  const image = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height))
    let width = Math.max(1, Math.round(image.width * scale))
    let height = Math.max(1, Math.round(image.height * scale))

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('この端末では写真を処理できません。')
      }

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      for (const quality of [0.88, 0.78, 0.68, 0.58]) {
        const blob = await canvasToBlob(canvas, quality)
        if (blob.size <= MAX_SANITIZED_PHOTO_BYTES) {
          return { blob, width, height }
        }
      }

      width = Math.max(1, Math.round(width * 0.8))
      height = Math.max(1, Math.round(height * 0.8))
    }
  } finally {
    image.close()
  }

  throw new Error('写真を5MB以下にできませんでした。別の写真を選んでください。')
}

export function uploadPhoto(
  uploadUrl: string,
  blob: Blob,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.setRequestHeader('Content-Type', 'image/jpeg')
    request.setRequestHeader('If-None-Match', '*')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`upload failed (${request.status})`))
      }
    })
    request.addEventListener('error', () => reject(new Error('upload failed')))
    request.addEventListener('abort', () => reject(new Error('upload aborted')))
    request.send(blob)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('写真を変換できませんでした。'))
        }
      },
      'image/jpeg',
      quality,
    )
  })
}
