export const MAX_PHOTOS_PER_LETTER = 3
export const MAX_SANITIZED_PHOTO_BYTES = 5 * 1024 * 1024
export const MAX_PHOTO_DIMENSION = 4096
export const SANITIZED_PHOTO_MIME_TYPE = 'image/jpeg'
export const UPLOAD_CAPABILITY_SECONDS = 5 * 60
export const DOWNLOAD_CAPABILITY_SECONDS = 60

export type InspectedPhoto = {
  mimeType: typeof SANITIZED_PHOTO_MIME_TYPE
  byteSize: number
  width: number
  height: number
}

export function assertExpectedPhotoMetadata(input: {
  mimeType: string
  byteSize: number
  width: number
  height: number
}): void {
  if (input.mimeType !== SANITIZED_PHOTO_MIME_TYPE) {
    throw new Error('photo must be sanitized as JPEG')
  }

  if (
    !Number.isInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > MAX_SANITIZED_PHOTO_BYTES
  ) {
    throw new Error('sanitized photo is too large')
  }

  assertDimensions(input.width, input.height)
}

export function inspectSanitizedPhoto(bytes: Uint8Array): InspectedPhoto {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SANITIZED_PHOTO_BYTES) {
    throw new Error('sanitized photo is too large')
  }

  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('uploaded photo is not a JPEG')
  }

  let offset = 2
  let width = 0
  let height = 0
  let hasStartOfScan = false
  let hasEndOfImage = false
  let inEntropyData = false

  while (offset < bytes.byteLength) {
    let marker: number

    if (inEntropyData) {
      while (offset < bytes.byteLength && bytes[offset] !== 0xff) {
        offset += 1
      }
      if (offset >= bytes.byteLength) {
        break
      }
      offset += 1
      while (offset < bytes.byteLength && bytes[offset] === 0xff) {
        offset += 1
      }
      if (offset >= bytes.byteLength) {
        break
      }
      marker = bytes[offset]
      offset += 1

      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue
      }
      inEntropyData = false
    } else {
      if (bytes[offset] !== 0xff) {
        throw new Error('uploaded JPEG marker structure is malformed')
      }
      offset += 1
      while (offset < bytes.byteLength && bytes[offset] === 0xff) {
        offset += 1
      }
      if (offset >= bytes.byteLength) {
        break
      }
      marker = bytes[offset]
      offset += 1
    }

    if (marker === 0xd8 || marker === 0x01) {
      continue
    }

    if (marker === 0xd9) {
      hasEndOfImage = true
      break
    }

    if (offset + 2 > bytes.byteLength) {
      throw new Error('uploaded JPEG is truncated')
    }

    const segmentLength = readUint16(bytes, offset)

    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      throw new Error('uploaded JPEG is malformed')
    }

    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      throw new Error('uploaded photo still contains location-capable metadata')
    }

    if (isStartOfFrame(marker)) {
      if (segmentLength < 7) {
        throw new Error('uploaded JPEG dimensions are malformed')
      }

      height = readUint16(bytes, offset + 3)
      width = readUint16(bytes, offset + 5)
    }

    offset += segmentLength
    if (marker === 0xda) {
      hasStartOfScan = true
      inEntropyData = true
    }
  }

  assertDimensions(width, height)

  if (!hasStartOfScan || !hasEndOfImage || offset !== bytes.byteLength) {
    throw new Error('uploaded JPEG is incomplete or has trailing data')
  }

  let decodedWidth = 0
  let decodedHeight = 0
  try {
    const decoded = decode(bytes, {
      useTArray: true,
      formatAsRGBA: false,
      tolerantDecoding: false,
      maxResolutionInMP: 17,
      maxMemoryUsageInMB: 128,
    })
    decodedWidth = decoded.width
    decodedHeight = decoded.height
  } catch {
    throw new Error('uploaded JPEG cannot be decoded')
  }

  if (decodedWidth !== width || decodedHeight !== height) {
    throw new Error('uploaded JPEG dimensions are inconsistent')
  }

  return {
    mimeType: SANITIZED_PHOTO_MIME_TYPE,
    byteSize: bytes.byteLength,
    width,
    height,
  }
}

function assertDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_PHOTO_DIMENSION ||
    height > MAX_PHOTO_DIMENSION
  ) {
    throw new Error('photo dimensions are invalid')
  }
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function isStartOfFrame(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
    marker,
  )
}
import { decode } from 'jpeg-js'
