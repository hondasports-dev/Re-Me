import { describe, expect, it } from 'vitest'

import { createCapability, verifyCapability } from '../../worker/capability'
import type { AppEnv } from '../../worker/types'

const localEnv = { APP_ENV: 'local' } as AppEnv

describe('Worker attachment capabilities', () => {
  it('binds the token to attachment, generation, purpose, and expiration', async () => {
    const token = await createCapability(localEnv, {
      attachmentId: 'attachment-1',
      generationToken: 'generation-1',
      purpose: 'download',
      expiresAt: Date.now() + 60_000,
    })

    await expect(
      verifyCapability(localEnv, token, {
        attachmentId: 'attachment-1',
        generationToken: 'generation-1',
        purpose: 'download',
      }),
    ).resolves.toMatchObject({
      attachmentId: 'attachment-1',
      generationToken: 'generation-1',
      purpose: 'download',
    })

    await expect(
      verifyCapability(localEnv, token, {
        attachmentId: 'attachment-1',
        generationToken: 'generation-1',
        purpose: 'upload',
      }),
    ).rejects.toThrow('capability_invalid')
  })

  it('does not sign non-local capabilities without the configured secret', async () => {
    const previewEnv = { APP_ENV: 'preview' } as AppEnv
    await expect(
      createCapability(previewEnv, {
        attachmentId: 'attachment-1',
        generationToken: 'generation-1',
        purpose: 'upload',
        expiresAt: Date.now() + 60_000,
      }),
    ).rejects.toThrow('capability_configuration_missing')
  })
})
