import { afterEach, describe, expect, it, vi } from 'vitest'

import { MAX_INPUT_PHOTO_BYTES, sanitizePhoto } from '../../src/features/compose/model/photo'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('client photo sanitizer', () => {
  it('rejects unsupported formats and input files over 10 MiB', async () => {
    await expect(
      sanitizePhoto(new File(['text'], 'note.txt', { type: 'text/plain' })),
    ).rejects.toThrow(/JPEG・PNG・WebP/)
    await expect(
      sanitizePhoto(
        new File([new Uint8Array(MAX_INPUT_PHOTO_BYTES + 1)], 'large.jpg', {
          type: 'image/jpeg',
        }),
      ),
    ).rejects.toThrow(/10MB/)
  })

  it('draws to a 4096px canvas and returns a fresh JPEG blob', async () => {
    const close = vi.fn()
    const drawImage = vi.fn()
    const fillRect = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 8000, height: 4000, close }),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      fillRect,
      set fillStyle(_value: string) {},
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      callback(new Blob([new Uint8Array(1024)], { type: type ?? undefined }))
    })

    const result = await sanitizePhoto(new File(['source'], 'photo.webp', { type: 'image/webp' }))

    expect(result).toMatchObject({ width: 4096, height: 2048 })
    expect(result.blob.type).toBe('image/jpeg')
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4096, 2048)
    expect(fillRect).toHaveBeenCalledWith(0, 0, 4096, 2048)
    expect(close).toHaveBeenCalledOnce()
  })
})
