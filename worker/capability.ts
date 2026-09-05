import { HttpError } from './errors'
import type { AppEnv } from './types'

type CapabilityPurpose = 'upload' | 'download'

interface CapabilityPayload {
  attachmentId: string
  generationToken: string
  purpose: CapabilityPurpose
  expiresAt: number
}

const LOCAL_CAPABILITY_SECRET = 're-me-local-capability-secret-change-me'

export async function createCapability(
  env: AppEnv,
  input: Omit<CapabilityPayload, 'expiresAt'> & { expiresAt: number },
): Promise<string> {
  const payload = encodeJson(input)
  const signature = await sign(env, payload)
  return `${payload}.${signature}`
}

export async function verifyCapability(
  env: AppEnv,
  token: string | null,
  expected: { attachmentId: string; generationToken: string; purpose: CapabilityPurpose },
): Promise<CapabilityPayload> {
  if (!token) {
    throw new HttpError(401, 'capability_required')
  }

  const separator = token.lastIndexOf('.')
  if (separator <= 0 || separator === token.length - 1) {
    throw new HttpError(401, 'capability_invalid')
  }

  const payloadPart = token.slice(0, separator)
  const signature = token.slice(separator + 1)

  try {
    const valid = await verifySignature(env, payloadPart, signature)
    if (!valid) {
      throw new Error('invalid_signature')
    }

    const payload = decodeJson(payloadPart)
    if (
      payload.attachmentId !== expected.attachmentId ||
      payload.generationToken !== expected.generationToken ||
      payload.purpose !== expected.purpose ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt < Date.now()
    ) {
      throw new Error('invalid_payload')
    }

    return payload
  } catch (error) {
    if (error instanceof HttpError && error.status === 503) throw error
    throw new HttpError(401, 'capability_invalid')
  }
}

function encodeJson(payload: CapabilityPayload): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

function decodeJson(value: string): CapabilityPayload {
  const decoded = new TextDecoder().decode(decodeBase64Url(value))
  const parsed = JSON.parse(decoded) as Partial<CapabilityPayload>
  if (
    typeof parsed.attachmentId !== 'string' ||
    typeof parsed.generationToken !== 'string' ||
    (parsed.purpose !== 'upload' && parsed.purpose !== 'download') ||
    typeof parsed.expiresAt !== 'number'
  ) {
    throw new Error('invalid_payload')
  }
  return parsed as CapabilityPayload
}

async function sign(env: AppEnv, payload: string): Promise<string> {
  const key = await importSecret(env)
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload).buffer as ArrayBuffer,
  )
  return encodeBase64Url(new Uint8Array(signature))
}

async function verifySignature(env: AppEnv, payload: string, signature: string): Promise<boolean> {
  const key = await importSecret(env)
  return await crypto.subtle.verify(
    'HMAC',
    key,
    decodeBase64Url(signature).buffer as ArrayBuffer,
    new TextEncoder().encode(payload).buffer as ArrayBuffer,
  )
}

async function importSecret(env: AppEnv): Promise<CryptoKey> {
  const configured = env.CAPABILITY_SECRET?.trim()
  if (env.APP_ENV !== 'local' && !configured) {
    throw new HttpError(503, 'capability_configuration_missing')
  }

  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(configured || LOCAL_CAPABILITY_SECRET).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
