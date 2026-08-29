export const LEGACY_PUBLIC_TABLES = [
  'user_settings',
  'threads',
  'letters',
  'letter_contents',
  'letter_attachments',
  'push_subscriptions',
] as const

export const LEGACY_PRIVATE_TABLES = ['letter_delivery', 'notification_jobs'] as const

export type MigrationNecessity = 'no_production_import' | 'import_required'

export type InventoryInput = {
  productionStackProvisioned: boolean
  productionUserOrLetterRows: number
  gitHasLegacyMigrations: boolean
  gitHasProductionDump: boolean
}

export type IdentityMapRow = {
  supabaseUserId: string
  auth0Issuer: string
  auth0Sub: string
}

export type LetterVisibility = {
  sealed: boolean
  status: 'draft' | 'traveling' | 'delivered'
  openedAt: number | null
  deletedAt: number | null
}

export type HumanGateOperation =
  | 'production_export'
  | 'production_import'
  | 'production_data_mutation'
  | 'legacy_production_deletion'
  | 'irreversible_credential_deletion'
  | 'local_schema_compare'
  | 'preview_e2e_reset'

export function decideMigrationNecessity(input: InventoryInput): MigrationNecessity {
  if (!input.gitHasLegacyMigrations) {
    throw new Error('legacy_migrations_missing')
  }

  if (input.gitHasProductionDump) {
    return 'import_required'
  }

  if (input.productionUserOrLetterRows > 0) {
    return 'import_required'
  }

  return 'no_production_import'
}

export function convexTokenIdentifier(auth0Issuer: string, auth0Sub: string): string {
  const issuer = auth0Issuer.replace(/\/+$/, '')
  if (!issuer || !auth0Sub || issuer.includes('|')) {
    throw new Error('identity_mapping_invalid')
  }

  return `${issuer}|${auth0Sub}`
}

export function buildIdentityMap(rows: IdentityMapRow[]): Map<string, string> {
  const mapped = new Map<string, string>()

  for (const row of rows) {
    const tokenIdentifier = convexTokenIdentifier(row.auth0Issuer, row.auth0Sub)
    const existing = mapped.get(row.supabaseUserId)
    if (existing && existing !== tokenIdentifier) {
      throw new Error('identity_mapping_conflict')
    }
    mapped.set(row.supabaseUserId, tokenIdentifier)
  }

  return mapped
}

const TIMESTAMP_WITH_OFFSET =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)$/i

function normalizeUtcOffset(offset: string): string {
  if (offset.toUpperCase() === 'Z') {
    return 'Z'
  }

  if (offset.length === 3) {
    return `${offset}:00`
  }

  if (offset.length === 5) {
    return `${offset.slice(0, 3)}:${offset.slice(3)}`
  }

  return offset
}

export function timestamptzToEpochMs(value: string): number {
  const match = value.trim().match(TIMESTAMP_WITH_OFFSET)
  const date = match?.[1]
  const time = match?.[2]
  const offset = match?.[3]
  if (!date || !time || !offset) {
    throw new Error('timestamp_missing_offset')
  }

  const parsed = Date.parse(`${date}T${time}${normalizeUtcOffset(offset)}`)
  if (Number.isNaN(parsed)) {
    throw new Error('timestamp_invalid')
  }
  return parsed
}

export function deriveNextLetterId(
  letters: Array<{ id: string; parentLetterId: string | null }>,
): Map<string, string> {
  const nextByParent = new Map<string, string>()

  for (const letter of letters) {
    if (!letter.parentLetterId) {
      continue
    }
    if (nextByParent.has(letter.parentLetterId)) {
      throw new Error('branching_thread_unsupported')
    }
    nextByParent.set(letter.parentLetterId, letter.id)
  }

  return nextByParent
}

export function canReadSealedBody(letter: LetterVisibility): boolean {
  if (letter.deletedAt !== null) {
    return false
  }
  if (!letter.sealed) {
    return true
  }
  return letter.status === 'delivered' && letter.openedAt !== null
}

export function publicLetterPayload(letter: {
  letterId: string
  status: LetterVisibility['status']
  sealed: boolean
  scheduledAt: number
}): Record<string, unknown> {
  return {
    letterId: letter.letterId,
    status: letter.status,
    sealed: letter.sealed,
  }
}

export function assertPublicPayloadHidesSchedule(payload: Record<string, unknown>): void {
  const serialized = JSON.stringify(payload)
  if (serialized.includes('scheduledAt') || serialized.includes('scheduled_at')) {
    throw new Error('scheduled_at_leaked')
  }
}

export type CountSnapshot = {
  users: number
  threads: number
  letters: number
  letterContents: number
  letterDeliveries: number
  photoAttachmentsWithObject: number
}

export function checksumDrift(source: CountSnapshot, imported: CountSnapshot): string[] {
  const drifts: string[] = []
  for (const key of Object.keys(source) as Array<keyof CountSnapshot>) {
    if (source[key] !== imported[key]) {
      drifts.push(key)
    }
  }
  return drifts
}

export function requiresHumanGate(operation: HumanGateOperation): boolean {
  return (
    operation === 'production_export' ||
    operation === 'production_import' ||
    operation === 'production_data_mutation' ||
    operation === 'legacy_production_deletion' ||
    operation === 'irreversible_credential_deletion'
  )
}
