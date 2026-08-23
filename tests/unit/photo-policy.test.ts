import { describe, expect, it } from 'vitest'
import { encode } from 'jpeg-js'

import { inspectSanitizedPhoto, MAX_SANITIZED_PHOTO_BYTES } from '../../convex/lib/photoPolicy'

function jpeg(width = 12, height = 8) {
  return new Uint8Array(
    encode({ data: new Uint8Array(width * height * 4), width, height }, 80).data,
  )
}

function insertSegment(bytes: Uint8Array, marker: number, payload: number[]) {
  const length = payload.length + 2
  return new Uint8Array([
    ...bytes.slice(0, 2),
    0xff,
    marker,
    (length >> 8) & 0xff,
    length & 0xff,
    ...payload,
    ...bytes.slice(2),
  ])
}

function replaceSofDimensions(bytes: Uint8Array, width: number, height: number) {
  const changed = bytes.slice()
  for (let offset = 2; offset < changed.length - 8; offset += 1) {
    if (changed[offset] === 0xff && changed[offset + 1] === 0xc0) {
      changed[offset + 5] = (height >> 8) & 0xff
      changed[offset + 6] = height & 0xff
      changed[offset + 7] = (width >> 8) & 0xff
      changed[offset + 8] = width & 0xff
      return changed
    }
  }
  throw new Error('SOF marker not found')
}

function insertBeforeEoi(bytes: Uint8Array, marker: number, payload: number[]) {
  const length = payload.length + 2
  return new Uint8Array([
    ...bytes.slice(0, -2),
    0xff,
    marker,
    (length >> 8) & 0xff,
    length & 0xff,
    ...payload,
    0xff,
    0xd9,
  ])
}

describe('sanitized photo inspection', () => {
  it('accepts a JPEG and reads its dimensions', () => {
    const bytes = jpeg()
    expect(inspectSanitizedPhoto(bytes)).toEqual({
      mimeType: 'image/jpeg',
      byteSize: bytes.byteLength,
      width: 12,
      height: 8,
    })
  })

  it('rejects EXIF/XMP and IPTC metadata segments', () => {
    expect(() =>
      inspectSanitizedPhoto(insertSegment(jpeg(), 0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0])),
    ).toThrow(/metadata/)
    expect(() => inspectSanitizedPhoto(insertSegment(jpeg(), 0xed, [1, 2, 3]))).toThrow(/metadata/)
    expect(() =>
      inspectSanitizedPhoto(insertBeforeEoi(jpeg(), 0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0])),
    ).toThrow(/metadata/)
    expect(() => inspectSanitizedPhoto(insertBeforeEoi(jpeg(), 0xed, [1, 2, 3]))).toThrow(
      /metadata/,
    )
  })

  it('rejects oversized dimensions, truncation, and data after EOI', () => {
    const bytes = jpeg()
    expect(() => inspectSanitizedPhoto(replaceSofDimensions(bytes, 4097, 8))).toThrow(/dimensions/)
    expect(() => inspectSanitizedPhoto(bytes.slice(0, -2))).toThrow(/incomplete/)
    expect(() => inspectSanitizedPhoto(new Uint8Array([...bytes, 0xff, 0xe1, 0, 2]))).toThrow(
      /trailing/,
    )
  })

  it('rejects payloads over the sanitized byte limit before parsing', () => {
    expect(() => inspectSanitizedPhoto(new Uint8Array(MAX_SANITIZED_PHOTO_BYTES + 1))).toThrow(
      /too large/,
    )
  })
})
