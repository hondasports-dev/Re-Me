import { MAX_PHOTO_BYTES } from './constants'

export interface InspectedPhoto {
  mimeType: 'image/jpeg'
  byteSize: number
  width: number
  height: number
}

const MAX_PHOTO_DIMENSION = 4096

export function inspectSanitizedPhoto(bytes: Uint8Array): InspectedPhoto {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error('photo_size_invalid')
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('photo_not_jpeg')
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
      while (offset < bytes.byteLength && bytes[offset] !== 0xff) offset += 1
      if (offset >= bytes.byteLength) break
      offset += 1
      while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1
      if (offset >= bytes.byteLength) break
      marker = bytes[offset]
      offset += 1
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue
      inEntropyData = false
    } else {
      if (bytes[offset] !== 0xff) throw new Error('photo_marker_malformed')
      offset += 1
      while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1
      if (offset >= bytes.byteLength) break
      marker = bytes[offset]
      offset += 1
    }

    if (marker === 0xd8 || marker === 0x01) continue
    if (marker === 0xd9) {
      hasEndOfImage = true
      break
    }
    if (offset + 2 > bytes.byteLength) throw new Error('photo_truncated')
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1]
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      throw new Error('photo_malformed')
    }
    // EXIF (APP1), IPTC (APP13), comments and similar metadata can retain
    // location information. The browser sanitiser emits none of these.
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      throw new Error('photo_metadata_present')
    }
    if (isStartOfFrame(marker)) {
      if (segmentLength < 7) throw new Error('photo_dimensions_malformed')
      height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      width = (bytes[offset + 5] << 8) | bytes[offset + 6]
    }
    offset += segmentLength
    if (marker === 0xda) {
      hasStartOfScan = true
      inEntropyData = true
    }
  }

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_PHOTO_DIMENSION ||
    height > MAX_PHOTO_DIMENSION
  ) {
    throw new Error('photo_dimensions_invalid')
  }
  if (!hasStartOfScan || !hasEndOfImage || offset !== bytes.byteLength) {
    throw new Error('photo_incomplete')
  }

  return { mimeType: 'image/jpeg', byteSize: bytes.byteLength, width, height }
}

function isStartOfFrame(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
    marker,
  )
}
