import { describe, expect, it } from 'vitest'
import { encode } from 'jpeg-js'

import { inspectSanitizedPhoto } from '../../worker/photo'

function jpeg(width = 12, height = 8): Uint8Array {
  return new Uint8Array(
    encode({ data: new Uint8Array(width * height * 4), width, height }, 80).data,
  )
}

function insertSegment(bytes: Uint8Array, marker: number, payload: number[]): Uint8Array {
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

describe('Worker photo inspection', () => {
  it('accepts sanitized JPEG bytes and returns their dimensions', () => {
    const bytes = jpeg()
    expect(inspectSanitizedPhoto(bytes)).toEqual({
      mimeType: 'image/jpeg',
      byteSize: bytes.byteLength,
      width: 12,
      height: 8,
    })
  })

  it('rejects metadata, non-JPEG input, and trailing bytes', () => {
    expect(() =>
      inspectSanitizedPhoto(insertSegment(jpeg(), 0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0])),
    ).toThrow('photo_metadata_present')
    expect(() => inspectSanitizedPhoto(new Uint8Array([0, 1, 2]))).toThrow('photo_not_jpeg')
    expect(() => inspectSanitizedPhoto(new Uint8Array([...jpeg(), 1]))).toThrow('photo_incomplete')
  })
})
