import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONVEX_SOURCE_TABLES = [
  'users',
  'userSettings',
  'threads',
  'letters',
  'letterContents',
  'letterAttachments',
  'attachmentFinalizationAttempts',
  'letterDeliveries',
  'notificationJobs',
  'pushSubscriptions',
] as const

export type ConvexSourceTable = (typeof CONVEX_SOURCE_TABLES)[number]
export type ConvexDocument = Record<string, unknown>
export type ConvexExport = Partial<Record<ConvexSourceTable, ConvexDocument[]>>
export type MigrationEnvironment = 'local' | 'preview' | 'production'
export type MigrationMode = 'dry-run' | 'sql'

type SqlValue = string | number | null

type ImportRow = {
  sourceTable: ConvexSourceTable
  sourceId: string
  targetTable: string
  targetId: string
  columns: string[]
  values: SqlValue[]
  sourceChecksum: string
}

export type R2MigrationObject = {
  attachmentId: string
  sourceKey: string
  targetKey: string
  contentEtag: string | null
  byteSize: number | null
}

export type MigrationPlan = {
  environment: MigrationEnvironment
  mode: MigrationMode
  sourceChecksum: string
  rows: ImportRow[]
  statements: string[]
  rollbackStatements: string[]
  r2Objects: R2MigrationObject[]
  counts: Record<string, number>
  warnings: string[]
}

export type BuildMigrationOptions = {
  environment?: MigrationEnvironment
  mode?: MigrationMode
  humanGate?: boolean
  now?: number
  r2CutoverId?: string
  generationTokenFactory?: (sourceId: string) => string
}

type LetterRecord = {
  id: string
  threadId: string
  ownerId: string
  parentLetterId: string | null
  nextLetterId: string | null
  status: 'draft' | 'traveling' | 'delivered'
  sealed: boolean
  deliveryMode: DeliveryMode | null
  deliveryWindowStart: number | null
  deliveryWindowEnd: number | null
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  repliedAt: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

type DeliveryMode = 'few_days' | 'few_weeks' | 'few_months' | 'about_year' | 'surprise'
type AttachmentKind = 'photo' | 'location'
type AttachmentStatus = 'pending' | 'ready' | 'deleting'

const DELIVERY_MODES = new Set<DeliveryMode>([
  'few_days',
  'few_weeks',
  'few_months',
  'about_year',
  'surprise',
])
const LETTER_STATUSES = new Set(['draft', 'traveling', 'delivered'])
const ATTACHMENT_KINDS = new Set<AttachmentKind>(['photo', 'location'])
const ATTACHMENT_STATUSES = new Set<AttachmentStatus>(['pending', 'ready', 'deleting'])
const DELIVERY_STATUSES = new Set(['pending', 'consumed', 'canceled'])
const NOTIFICATION_STATUSES = new Set(['pending', 'processing', 'sent', 'failed'])
const FINALIZATION_STATES = new Set(['claimed', 'winner', 'deleting'])

const IMPORT_TABLES: Array<{
  source: ConvexSourceTable
  target: string
  conflictColumn: string
}> = [
  { source: 'users', target: 'users', conflictColumn: 'id' },
  { source: 'userSettings', target: 'user_settings', conflictColumn: 'user_id' },
  { source: 'threads', target: 'threads', conflictColumn: 'id' },
  { source: 'letters', target: 'letters', conflictColumn: 'id' },
  { source: 'letterContents', target: 'letter_contents', conflictColumn: 'letter_id' },
  { source: 'letterAttachments', target: 'letter_attachments', conflictColumn: 'id' },
  {
    source: 'attachmentFinalizationAttempts',
    target: 'attachment_finalization_attempts',
    conflictColumn: 'id',
  },
  { source: 'letterDeliveries', target: 'letter_deliveries', conflictColumn: 'id' },
  { source: 'notificationJobs', target: 'notification_jobs', conflictColumn: 'id' },
  { source: 'pushSubscriptions', target: 'push_subscriptions', conflictColumn: 'id' },
]

const IMPORT_MAP_TABLE = 'migration_import_keys'

export function parseJsonLines(value: string, table: ConvexSourceTable): ConvexDocument[] {
  const documents: ConvexDocument[] = []

  for (const [index, line] of value.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new Error(`invalid_json_line:${table}:${index + 1}`)
    }
    documents.push(asDocument(parsed, `${table}:${index + 1}`))
  }

  return documents
}

export function parseTableExport(value: string, table?: ConvexSourceTable): ConvexExport {
  const trimmed = value.trim()
  if (!trimmed) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    if (!table) throw new Error('jsonl_requires_table')
    return { [table]: parseJsonLines(value, table) }
  }

  if (Array.isArray(parsed)) {
    if (!table) throw new Error('json_array_requires_table')
    return { [table]: parsed.map((item, index) => asDocument(item, `${table}:${index + 1}`)) }
  }

  if (!isRecord(parsed)) {
    throw new Error('export_root_must_be_object_or_array')
  }

  const result: ConvexExport = {}
  let recognizedTableCount = 0
  for (const [key, rows] of Object.entries(parsed)) {
    if (!isConvexSourceTable(key)) {
      continue
    }
    recognizedTableCount += 1
    if (!Array.isArray(rows)) {
      throw new Error(`table_must_be_array:${key}`)
    }
    result[key] = rows.map((item, index) => asDocument(item, `${key}:${index + 1}`))
  }
  if (recognizedTableCount === 0) {
    if (table) return { [table]: [asDocument(parsed, `${table}:1`)] }
    throw new Error('export_root_has_no_known_tables')
  }
  return result
}

export function buildMigrationPlan(
  input: ConvexExport,
  options: BuildMigrationOptions = {},
): MigrationPlan {
  const environment = options.environment ?? 'local'
  const mode = options.mode ?? 'dry-run'
  assertExecutionAllowed(environment, mode, options.humanGate === true)

  const normalized = normalizeExport(input)
  const now = options.now
  const sourceChecksum = sha256(canonicalJson(normalized))
  const sourceIds = new Map<ConvexSourceTable, Set<string>>()
  for (const table of CONVEX_SOURCE_TABLES) {
    sourceIds.set(table, collectUniqueIds(normalized[table] ?? [], table))
  }
  const userIds = sourceIds.get('users') as Set<string>
  const letterIds = sourceIds.get('letters') as Set<string>

  assertUniqueTokenIdentifiers(normalized.users ?? [])
  assertUserReferences(normalized, userIds)
  assertUniqueForeignKey(
    normalized.userSettings ?? [],
    'userId',
    'userSettings',
    'duplicate_user_settings',
  )
  const threadOwners = assertThreadReferences(normalized, userIds)

  const letters = normalizeLetters(normalized.letters ?? [], userIds, threadOwners)
  assertReplyGraph(letters, letterIds)
  assertLetterContentReferences(normalized.letterContents ?? [], letters, userIds)
  assertAttachmentReferences(normalized.letterAttachments ?? [], letterIds, userIds)
  assertChildOwnership(normalized, letters)
  const attachmentsById = new Map(
    (normalized.letterAttachments ?? []).map((attachment) => [
      requiredId(attachment, 'letterAttachments'),
      attachment,
    ]),
  )
  assertFinalizationReferences(normalized.attachmentFinalizationAttempts ?? [], attachmentsById)
  assertDeliveryReferences(normalized.letterDeliveries ?? [], letters, userIds)
  assertNotificationReferences(normalized.notificationJobs ?? [], letterIds, userIds)
  assertPushReferences(normalized.pushSubscriptions ?? [], userIds)

  const rows: ImportRow[] = []
  const r2Objects: R2MigrationObject[] = []
  if (mode === 'sql' && !options.r2CutoverId) {
    throw new Error('r2_cutover_id_required_for_sql')
  }
  const r2CutoverId = sanitizeCutoverId(options.r2CutoverId ?? 'dry-run')
  const generationTokenFactory =
    options.generationTokenFactory ??
    ((sourceId: string) => sha256(`${sourceChecksum}:notification:${sourceId}`))

  for (const table of IMPORT_TABLES) {
    for (const document of normalized[table.source] ?? []) {
      rows.push(
        mapDocument({
          table,
          document,
          letters,
          r2CutoverId,
          r2Objects,
          generationTokenFactory,
        }),
      )
    }
  }

  assertDeliveryStateCoverage(normalized.letters ?? [], normalized.letterDeliveries ?? [])
  const statements = buildImportStatements(rows, now)
  const rollbackStatements = buildRollbackStatements(rows, r2Objects)
  const counts = countRows(rows)
  const warnings = [
    'D1 import SQL is generated only; this tool never calls a remote D1/R2 API.',
    'R2 objects must be copied and checksum-verified before applying SQL that references targetKey.',
    'Rollback SQL is intended for an isolated migration target and requires a separate Human Gate in production.',
  ]

  return {
    environment,
    mode,
    sourceChecksum,
    rows,
    statements,
    rollbackStatements,
    r2Objects,
    counts,
    warnings,
  }
}

export function assertExecutionAllowed(
  environment: MigrationEnvironment,
  mode: MigrationMode,
  humanGate = false,
): void {
  if (environment === 'production' && mode === 'sql' && !humanGate) {
    throw new Error('production_human_gate_required')
  }
}

export function canReadMigratedContent(letter: {
  status: 'draft' | 'traveling' | 'delivered'
  sealed: boolean
  openedAt: number | null
  deletedAt: number | null
}): boolean {
  if (letter.deletedAt !== null) return false
  if (letter.status === 'draft' || !letter.sealed) return true
  return letter.status === 'delivered' && letter.openedAt !== null
}

export function toPublicLetterMetadata(letter: LetterRecord): Record<string, unknown> {
  return {
    letterId: letter.id,
    threadId: letter.threadId,
    parentLetterId: letter.parentLetterId,
    nextLetterId: letter.nextLetterId,
    status: letter.status,
    sealed: letter.sealed,
    deliveryMode: letter.deliveryMode,
    deliveryWindowStart: letter.deliveryWindowStart,
    deliveryWindowEnd: letter.deliveryWindowEnd,
    sentAt: letter.sentAt,
    deliveredAt: letter.deliveredAt,
    openedAt: letter.openedAt,
    repliedAt: letter.repliedAt,
    createdAt: letter.createdAt,
    updatedAt: letter.updatedAt,
  }
}

export function assertPublicProjectionHidesPrivateFields(payload: unknown): void {
  const serialized = JSON.stringify(payload)
  if (serialized.includes('scheduledAt') || serialized.includes('scheduled_at')) {
    throw new Error('scheduled_at_leaked')
  }
  if (serialized.includes('letterContents') || serialized.includes('letter_contents')) {
    throw new Error('private_content_table_leaked')
  }
}

export function buildImportSql(plan: MigrationPlan): string {
  return [
    '-- Generated by scripts/convex-to-d1-migration.ts. Review the manifest before applying.',
    '-- D1 execute applies these statements in order; stop on the first error.',
    '-- For an atomic Worker-side run, send plan.statements through D1 batch().',
    ...executableStatements(plan.statements),
    '',
  ].join('\n')
}

export function buildRollbackSql(plan: MigrationPlan): string {
  return [
    '-- Human Gate required for production rollback.',
    '-- D1 execute applies these statements in order; stop on the first error.',
    ...executableStatements(plan.rollbackStatements),
    '',
  ].join('\n')
}

function executableStatements(statements: string[]): string[] {
  return statements.length > 0 ? statements : ['SELECT 1;']
}

export function loadConvexExport(inputPath: string, table?: ConvexSourceTable): ConvexExport {
  const absolutePath = resolve(inputPath)
  if (!existsSync(absolutePath)) {
    throw new Error(`migration_input_not_found:${absolutePath}`)
  }

  if (isDirectory(absolutePath)) {
    return loadExportDirectory(absolutePath)
  }

  return parseTableExport(readFileSync(absolutePath, 'utf8'), table)
}

function loadExportDirectory(directory: string): ConvexExport {
  const result: ConvexExport = {}
  for (const table of CONVEX_SOURCE_TABLES) {
    const aliases = [table, toSnakeCase(table)]
    const file = aliases
      .flatMap((alias) => [join(directory, `${alias}.jsonl`), join(directory, `${alias}.json`)])
      .find((candidate) => existsSync(candidate))
    if (!file) continue

    const extension = extname(file).toLowerCase()
    const parsed =
      extension === '.jsonl'
        ? { [table]: parseJsonLines(readFileSync(file, 'utf8'), table) }
        : parseTableExport(readFileSync(file, 'utf8'), table)
    result[table] = parsed[table] ?? []
  }
  return result
}

function normalizeExport(input: ConvexExport): ConvexExport {
  if (!isRecord(input)) throw new Error('export_must_be_object')
  const result: ConvexExport = {}
  for (const table of CONVEX_SOURCE_TABLES) {
    const rows = input[table] ?? []
    if (!Array.isArray(rows)) throw new Error(`table_must_be_array:${table}`)
    result[table] = rows
      .map((row, index) => asDocument(row, `${table}:${index + 1}`))
      .sort((left, right) => requiredId(left, table).localeCompare(requiredId(right, table)))
  }
  return result
}

function mapDocument(input: {
  table: (typeof IMPORT_TABLES)[number]
  document: ConvexDocument
  letters: Map<string, LetterRecord>
  r2CutoverId: string
  r2Objects: R2MigrationObject[]
  generationTokenFactory: (sourceId: string) => string
}): ImportRow {
  const { table, document, letters, r2CutoverId, r2Objects, generationTokenFactory } = input
  const sourceId = requiredId(document, table.source)
  let sourceChecksum = sha256(canonicalJson(document))
  let targetId = sourceId
  let columns: string[]
  let values: SqlValue[]

  switch (table.source) {
    case 'users': {
      const createdAt = timestamp(document, 'createdAt', '_creationTime')
      columns = [
        'id',
        'token_identifier',
        'email',
        'name',
        'picture_url',
        'created_at',
        'updated_at',
      ]
      values = [
        sourceId,
        requiredString(document, 'tokenIdentifier', 'users'),
        optionalString(document, 'email'),
        optionalString(document, 'name'),
        optionalString(document, 'pictureUrl'),
        createdAt,
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
      ]
      break
    }
    case 'userSettings':
      targetId = requiredString(document, 'userId', table.source)
      columns = [
        'user_id',
        'timezone',
        'push_enabled',
        'email_notification_enabled',
        'created_at',
        'updated_at',
      ]
      values = [
        targetId,
        requiredString(document, 'timezone', table.source),
        booleanInteger(document, 'pushEnabled', false),
        booleanInteger(document, 'emailNotificationEnabled', false),
        timestamp(document, 'createdAt', '_creationTime'),
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
      ]
      break
    case 'threads':
      columns = ['id', 'owner_id', 'created_at', 'updated_at', 'deleted_at']
      values = [
        sourceId,
        requiredString(document, 'ownerId', table.source),
        timestamp(document, 'createdAt', '_creationTime'),
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
        optionalTimestamp(document, 'deletedAt'),
      ]
      break
    case 'letters': {
      const letter = letters.get(sourceId)
      if (!letter) throw new Error(`letter_normalization_missing:${sourceId}`)
      columns = [
        'id',
        'thread_id',
        'owner_id',
        'parent_letter_id',
        'next_letter_id',
        'status',
        'sealed',
        'delivery_mode',
        'delivery_window_start',
        'delivery_window_end',
        'sent_at',
        'delivered_at',
        'opened_at',
        'replied_at',
        'created_at',
        'updated_at',
        'deleted_at',
      ]
      values = [
        letter.id,
        letter.threadId,
        letter.ownerId,
        letter.parentLetterId,
        letter.nextLetterId,
        letter.status,
        letter.sealed ? 1 : 0,
        letter.deliveryMode,
        letter.deliveryWindowStart,
        letter.deliveryWindowEnd,
        letter.sentAt,
        letter.deliveredAt,
        letter.openedAt,
        letter.repliedAt,
        letter.createdAt,
        letter.updatedAt,
        letter.deletedAt,
      ]
      break
    }
    case 'letterContents':
      targetId = requiredString(document, 'letterId', table.source)
      columns = ['letter_id', 'owner_id', 'body', 'created_at', 'updated_at']
      values = [
        targetId,
        requiredString(document, 'ownerId', table.source),
        requiredBody(document),
        timestamp(document, 'createdAt', '_creationTime'),
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
      ]
      break
    case 'letterAttachments': {
      const kind = enumValue(document, 'kind', ATTACHMENT_KINDS, table.source) as AttachmentKind
      const status = enumValue(
        document,
        'status',
        ATTACHMENT_STATUSES,
        table.source,
      ) as AttachmentStatus
      const sourceR2Key = optionalString(document, 'r2ObjectId')
      const sourceUploadKey = optionalString(document, 'uploadR2ObjectId')
      const targetAttachmentKey = `migration/${r2CutoverId}/attachments/${safePathSegment(sourceId)}.jpg`
      const targetStagingKey = `migration/${r2CutoverId}/staging/${safePathSegment(sourceId)}.jpg`
      const r2ObjectKey = sourceR2Key ? targetAttachmentKey : null
      const uploadObjectKey = sourceUploadKey ? targetStagingKey : null

      if (kind === 'photo' && status === 'ready' && !sourceR2Key) {
        throw new Error(`photo_object_missing:${sourceId}`)
      }
      const locationLabel = optionalString(document, 'locationLabel')
      if (kind === 'photo' && locationLabel !== null) {
        throw new Error(`photo_location_label_invalid:${sourceId}`)
      }
      if (kind === 'location' && !optionalString(document, 'locationLabel')) {
        throw new Error(`location_label_missing:${sourceId}`)
      }
      if (kind === 'location' && (sourceR2Key !== null || sourceUploadKey !== null)) {
        throw new Error(`location_object_invalid:${sourceId}`)
      }
      if (locationLabel !== null && locationLabel.length > 80) {
        throw new Error(`location_label_too_long:${sourceId}`)
      }
      const byteSize = optionalInteger(document, 'byteSize')
      const width = optionalInteger(document, 'width')
      const height = optionalInteger(document, 'height')
      const deleteAttemptCount = optionalInteger(document, 'deleteAttemptCount')
      if (byteSize !== null && byteSize < 0) throw new Error(`byte_size_invalid:${sourceId}`)
      if (width !== null && width <= 0) throw new Error(`width_invalid:${sourceId}`)
      if (height !== null && height <= 0) throw new Error(`height_invalid:${sourceId}`)
      if (deleteAttemptCount !== null && deleteAttemptCount < 0) {
        throw new Error(`delete_attempt_count_invalid:${sourceId}`)
      }
      if (sourceR2Key) {
        r2Objects.push({
          attachmentId: sourceId,
          sourceKey: sourceR2Key,
          targetKey: targetAttachmentKey,
          contentEtag: optionalString(document, 'contentEtag'),
          byteSize,
        })
      }
      if (sourceUploadKey) {
        r2Objects.push({
          attachmentId: sourceId,
          sourceKey: sourceUploadKey,
          targetKey: targetStagingKey,
          contentEtag: null,
          byteSize,
        })
      }

      columns = [
        'id',
        'letter_id',
        'owner_id',
        'kind',
        'status',
        'r2_object_key',
        'upload_r2_object_key',
        'content_etag',
        'mime_type',
        'byte_size',
        'width',
        'height',
        'generation_token',
        'upload_expires_at',
        'delete_attempt_count',
        'next_reconcile_at',
        'last_error_code',
        'location_label',
        'created_at',
        'updated_at',
      ]
      values = [
        sourceId,
        requiredString(document, 'letterId', table.source),
        requiredString(document, 'ownerId', table.source),
        kind,
        status,
        r2ObjectKey,
        uploadObjectKey,
        optionalString(document, 'contentEtag'),
        optionalString(document, 'mimeType'),
        byteSize,
        width,
        height,
        optionalString(document, 'generationToken'),
        optionalTimestamp(document, 'uploadExpiresAt'),
        deleteAttemptCount,
        optionalTimestamp(document, 'nextReconcileAt'),
        optionalString(document, 'lastErrorCode'),
        locationLabel,
        timestamp(document, 'createdAt', '_creationTime'),
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
      ]
      sourceChecksum = checksumWithTargetMapping(document, {
        r2CutoverId,
        r2ObjectKey,
        uploadObjectKey,
      })
      break
    }
    case 'attachmentFinalizationAttempts': {
      const attachmentId = requiredString(document, 'attachmentId', table.source)
      const sourceObjectKey = requiredString(document, 'objectKey', table.source)
      const existingObject = r2Objects.find((object) => object.sourceKey === sourceObjectKey)
      const targetObjectKey =
        existingObject?.targetKey ??
        `migration/${r2CutoverId}/finalization/${safePathSegment(attachmentId)}/${safePathSegment(sourceId)}.jpg`
      if (!existingObject) {
        r2Objects.push({
          attachmentId,
          sourceKey: sourceObjectKey,
          targetKey: targetObjectKey,
          contentEtag: null,
          byteSize: null,
        })
      }
      columns = [
        'id',
        'attachment_id',
        'generation_token',
        'runner_token',
        'object_key',
        'state',
        'delete_attempt_count',
        'next_reconcile_at',
        'retire_after',
        'last_error_code',
        'created_at',
        'updated_at',
      ]
      enumValue(document, 'state', FINALIZATION_STATES, table.source)
      const deleteAttemptCount = nonNegativeInteger(document, 'deleteAttemptCount', table.source)
      values = [
        sourceId,
        attachmentId,
        requiredString(document, 'generationToken', table.source),
        requiredString(document, 'runnerToken', table.source),
        targetObjectKey,
        requiredString(document, 'state', table.source),
        deleteAttemptCount,
        optionalTimestamp(document, 'nextReconcileAt'),
        optionalTimestamp(document, 'retireAfter'),
        optionalString(document, 'lastErrorCode'),
        timestamp(document, 'createdAt', '_creationTime'),
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
      ]
      sourceChecksum = checksumWithTargetMapping(document, { r2CutoverId, targetObjectKey })
      break
    }
    case 'letterDeliveries': {
      columns = [
        'id',
        'letter_id',
        'owner_id',
        'scheduled_at',
        'status',
        'attempt_count',
        'last_attempt_at',
        'created_at',
      ]
      enumValue(document, 'status', DELIVERY_STATUSES, table.source)
      const scheduledAt = timestamp(document, 'scheduledAt')
      const attemptCount = nonNegativeInteger(document, 'attemptCount', table.source)
      values = [
        sourceId,
        requiredString(document, 'letterId', table.source),
        requiredString(document, 'ownerId', table.source),
        scheduledAt,
        requiredString(document, 'status', table.source),
        attemptCount,
        optionalTimestamp(document, 'lastAttemptAt'),
        timestamp(document, 'createdAt', '_creationTime'),
      ]
      break
    }
    case 'notificationJobs': {
      const generationToken =
        optionalString(document, 'generationToken') ?? generationTokenFactory(sourceId)
      if (!generationToken || typeof generationToken !== 'string') {
        throw new Error(`notification_generation_token_invalid:${sourceId}`)
      }
      columns = [
        'id',
        'letter_id',
        'owner_id',
        'status',
        'attempt_count',
        'generation_token',
        'available_at',
        'locked_at',
        'sent_at',
        'last_error_code',
        'created_at',
        'updated_at',
      ]
      enumValue(document, 'status', NOTIFICATION_STATUSES, table.source)
      values = [
        sourceId,
        requiredString(document, 'letterId', table.source),
        requiredString(document, 'ownerId', table.source),
        requiredString(document, 'status', table.source),
        nonNegativeInteger(document, 'attemptCount', table.source),
        generationToken,
        timestamp(document, 'availableAt'),
        optionalTimestamp(document, 'lockedAt'),
        optionalTimestamp(document, 'sentAt'),
        optionalString(document, 'lastErrorCode'),
        timestamp(document, 'createdAt', '_creationTime'),
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
      ]
      break
    }
    case 'pushSubscriptions':
      columns = [
        'id',
        'owner_id',
        'endpoint',
        'p256dh',
        'auth',
        'user_agent',
        'created_at',
        'updated_at',
        'disabled_at',
      ]
      values = [
        sourceId,
        requiredString(document, 'ownerId', table.source),
        requiredString(document, 'endpoint', table.source),
        requiredString(document, 'p256dh', table.source),
        requiredString(document, 'auth', table.source),
        optionalString(document, 'userAgent'),
        timestamp(document, 'createdAt', '_creationTime'),
        timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
        optionalTimestamp(document, 'disabledAt'),
      ]
      break
  }

  return {
    sourceTable: table.source,
    sourceId,
    targetTable: table.target,
    targetId,
    columns,
    values,
    sourceChecksum,
  }
}

function normalizeLetters(
  documents: ConvexDocument[],
  userIds: Set<string>,
  threadOwners: Map<string, string>,
): Map<string, LetterRecord> {
  const letters = new Map<string, LetterRecord>()
  for (const document of documents) {
    const id = requiredId(document, 'letters')
    const status = enumValue(
      document,
      'status',
      LETTER_STATUSES,
      'letters',
    ) as LetterRecord['status']
    const deliveryMode = optionalEnum(
      document,
      'deliveryMode',
      DELIVERY_MODES,
    ) as DeliveryMode | null
    const record: LetterRecord = {
      id,
      threadId: requiredString(document, 'threadId', 'letters'),
      ownerId: requiredString(document, 'ownerId', 'letters'),
      parentLetterId: optionalString(document, 'parentLetterId'),
      nextLetterId: optionalString(document, 'nextLetterId'),
      status,
      sealed: requiredBoolean(document, 'sealed', 'letters'),
      deliveryMode,
      deliveryWindowStart: optionalTimestamp(document, 'deliveryWindowStart'),
      deliveryWindowEnd: optionalTimestamp(document, 'deliveryWindowEnd'),
      sentAt: optionalTimestamp(document, 'sentAt'),
      deliveredAt: optionalTimestamp(document, 'deliveredAt'),
      openedAt: optionalTimestamp(document, 'openedAt'),
      repliedAt: optionalTimestamp(document, 'repliedAt'),
      createdAt: timestamp(document, 'createdAt', '_creationTime'),
      updatedAt: timestamp(document, 'updatedAt', 'createdAt', '_creationTime'),
      deletedAt: optionalTimestamp(document, 'deletedAt'),
    }
    if (!userIds.has(record.ownerId)) throw new Error(`orphan_owner:letters:${id}`)
    const threadOwner = threadOwners.get(record.threadId)
    if (!threadOwner) throw new Error(`orphan_thread:letters:${id}`)
    if (threadOwner !== record.ownerId) {
      throw new Error(`letter_thread_owner_mismatch:${id}`)
    }
    assertLetterState(record)
    if (letters.has(id)) throw new Error(`duplicate_id:letters:${id}`)
    letters.set(id, record)
  }

  const nextByParent = new Map<string, string>()
  for (const letter of letters.values()) {
    if (!letter.parentLetterId || letter.deletedAt !== null) continue
    const existing = nextByParent.get(letter.parentLetterId)
    if (existing && existing !== letter.id) {
      throw new Error(`branching_thread_unsupported:${letter.parentLetterId}`)
    }
    nextByParent.set(letter.parentLetterId, letter.id)
  }

  for (const letter of letters.values()) {
    const derivedNext = nextByParent.get(letter.id) ?? null
    if (letter.nextLetterId !== null && letter.nextLetterId !== derivedNext) {
      const pointed = letters.get(letter.nextLetterId)
      const staleDeletedReply =
        derivedNext === null && pointed?.parentLetterId === letter.id && pointed.deletedAt !== null
      if (!staleDeletedReply) throw new Error(`next_letter_mapping_conflict:${letter.id}`)
      continue
    }
    letter.nextLetterId = derivedNext
  }
  return letters
}

function assertReplyGraph(letters: Map<string, LetterRecord>, letterIds: Set<string>): void {
  for (const letter of letters.values()) {
    if (letter.parentLetterId === null) continue
    const parent = letters.get(letter.parentLetterId)
    if (!parent || !letterIds.has(letter.parentLetterId)) {
      throw new Error(`orphan_parent_letter:${letter.id}`)
    }
    if (parent.ownerId !== letter.ownerId || parent.threadId !== letter.threadId) {
      throw new Error(`reply_owner_or_thread_mismatch:${letter.id}`)
    }
    if (parent.deletedAt !== null || parent.status !== 'delivered') {
      throw new Error(`reply_parent_not_replyable:${letter.id}`)
    }

    const seen = new Set<string>([letter.id])
    let current: LetterRecord | undefined = parent
    while (current) {
      if (seen.has(current.id)) throw new Error(`letter_parent_cycle:${letter.id}`)
      seen.add(current.id)
      current = current.parentLetterId ? letters.get(current.parentLetterId) : undefined
    }
  }
}

function assertLetterState(letter: LetterRecord): void {
  if (letter.deliveryWindowStart !== null && letter.deliveryWindowEnd !== null) {
    if (letter.deliveryWindowStart > letter.deliveryWindowEnd) {
      throw new Error(`delivery_window_order_invalid:${letter.id}`)
    }
  }

  if (letter.status === 'draft') {
    if (
      letter.sentAt !== null ||
      letter.deliveredAt !== null ||
      letter.deliveryMode !== null ||
      letter.deliveryWindowStart !== null ||
      letter.deliveryWindowEnd !== null ||
      letter.openedAt !== null ||
      letter.repliedAt !== null
    ) {
      throw new Error(`draft_state_inconsistent:${letter.id}`)
    }
    return
  }

  if (letter.openedAt !== null && letter.status !== 'delivered') {
    throw new Error(`opened_state_inconsistent:${letter.id}`)
  }
  if (
    letter.repliedAt !== null &&
    (letter.status !== 'delivered' || letter.nextLetterId === null)
  ) {
    throw new Error(`reply_state_inconsistent:${letter.id}`)
  }

  if (
    letter.sentAt === null ||
    letter.deliveryMode === null ||
    letter.deliveryWindowStart === null ||
    letter.deliveryWindowEnd === null
  ) {
    throw new Error(`sent_state_inconsistent:${letter.id}`)
  }

  if (letter.status === 'traveling' && letter.deliveredAt !== null) {
    throw new Error(`traveling_state_inconsistent:${letter.id}`)
  }
  if (letter.status === 'delivered' && letter.deliveredAt === null) {
    throw new Error(`delivered_state_inconsistent:${letter.id}`)
  }
}

function assertDeliveryStateCoverage(
  letters: ConvexDocument[],
  deliveries: ConvexDocument[],
): void {
  const sentLetterIds = new Set(
    letters.flatMap((letter) => {
      const status = optionalString(letter, 'status')
      return status === 'traveling' || status === 'delivered' ? [requiredId(letter, 'letters')] : []
    }),
  )
  const deliveryLetterIds = new Set(
    deliveries.map((delivery) => requiredString(delivery, 'letterId', 'letterDeliveries')),
  )
  for (const letterId of sentLetterIds) {
    if (!deliveryLetterIds.has(letterId)) throw new Error(`delivery_missing:${letterId}`)
  }
  for (const letterId of deliveryLetterIds) {
    if (!sentLetterIds.has(letterId)) throw new Error(`delivery_for_draft:${letterId}`)
  }
}

function assertLetterContentReferences(
  documents: ConvexDocument[],
  letters: Map<string, LetterRecord>,
  userIds: Set<string>,
): void {
  const seen = new Set<string>()
  for (const document of documents) {
    const letterId = requiredString(document, 'letterId', 'letterContents')
    const letter = letters.get(letterId)
    if (!letter) throw new Error(`orphan_letter_content:${letterId}`)
    const ownerId = requiredString(document, 'ownerId', 'letterContents')
    if (!userIds.has(ownerId)) throw new Error(`orphan_owner:letterContents:${letterId}`)
    if (seen.has(letterId)) throw new Error(`duplicate_letter_content:${letterId}`)
    seen.add(letterId)
    const body = requiredBody(document)
    if (letter.status !== 'draft' && body.trim().length === 0) {
      throw new Error(`sent_letter_body_empty:${letterId}`)
    }
  }
  for (const letterId of letters.keys()) {
    if (!seen.has(letterId)) throw new Error(`letter_content_missing:${letterId}`)
  }
}

function assertAttachmentReferences(
  documents: ConvexDocument[],
  letterIds: Set<string>,
  userIds: Set<string>,
): void {
  const seen = new Set<string>()
  for (const document of documents) {
    const id = requiredId(document, 'letterAttachments')
    const letterId = requiredString(document, 'letterId', 'letterAttachments')
    const ownerId = requiredString(document, 'ownerId', 'letterAttachments')
    if (!letterIds.has(letterId)) throw new Error(`orphan_letter_attachment:${id}`)
    if (!userIds.has(ownerId)) throw new Error(`orphan_owner:letterAttachments:${id}`)
    if (seen.has(id)) throw new Error(`duplicate_id:letterAttachments:${id}`)
    seen.add(id)
  }
}

function assertFinalizationReferences(
  documents: ConvexDocument[],
  attachments: Map<string, ConvexDocument>,
): void {
  for (const document of documents) {
    const id = requiredId(document, 'attachmentFinalizationAttempts')
    const attachmentId = requiredString(document, 'attachmentId', 'attachmentFinalizationAttempts')
    const attachment = attachments.get(attachmentId)
    if (!attachment) throw new Error(`orphan_finalization_attachment:${id}`)
    if (optionalString(attachment, 'kind') !== 'photo') {
      throw new Error(`finalization_photo_required:${id}`)
    }
    const attachmentGenerationToken = optionalString(attachment, 'generationToken')
    const attemptGenerationToken = requiredString(
      document,
      'generationToken',
      'attachmentFinalizationAttempts',
    )
    if (!attachmentGenerationToken || attemptGenerationToken !== attachmentGenerationToken) {
      throw new Error(`finalization_generation_mismatch:${id}`)
    }
  }
}

function assertDeliveryReferences(
  documents: ConvexDocument[],
  letters: Map<string, LetterRecord>,
  userIds: Set<string>,
): void {
  const seenLetters = new Set<string>()
  for (const document of documents) {
    const id = requiredId(document, 'letterDeliveries')
    const letterId = requiredString(document, 'letterId', 'letterDeliveries')
    const ownerId = requiredString(document, 'ownerId', 'letterDeliveries')
    const letter = letters.get(letterId)
    if (!letter) throw new Error(`orphan_delivery:${id}`)
    if (!userIds.has(ownerId)) throw new Error(`orphan_owner:letterDeliveries:${id}`)
    if (letter.ownerId !== ownerId) throw new Error(`delivery_owner_mismatch:${id}`)
    if (seenLetters.has(letterId)) throw new Error(`duplicate_delivery:${letterId}`)
    seenLetters.add(letterId)
    const status = enumValue(document, 'status', DELIVERY_STATUSES, 'letterDeliveries')
    if (letter.status === 'traveling' && letter.deletedAt === null && status !== 'pending') {
      throw new Error(`delivery_state_mismatch:${id}:traveling:${status}`)
    }
    if (letter.status === 'traveling' && letter.deletedAt !== null && status !== 'canceled') {
      throw new Error(`delivery_state_mismatch:${id}:deleted_traveling:${status}`)
    }
    if (letter.status === 'delivered' && status !== 'consumed') {
      throw new Error(`delivery_state_mismatch:${id}:delivered:${status}`)
    }
    timestamp(document, 'scheduledAt')
    nonNegativeInteger(document, 'attemptCount', 'letterDeliveries')
  }
}

function assertNotificationReferences(
  documents: ConvexDocument[],
  letterIds: Set<string>,
  userIds: Set<string>,
): void {
  const seenLetters = new Set<string>()
  for (const document of documents) {
    const id = requiredId(document, 'notificationJobs')
    const letterId = requiredString(document, 'letterId', 'notificationJobs')
    const ownerId = requiredString(document, 'ownerId', 'notificationJobs')
    if (!letterIds.has(letterId)) throw new Error(`orphan_notification:${id}`)
    if (!userIds.has(ownerId)) throw new Error(`orphan_owner:notificationJobs:${id}`)
    if (seenLetters.has(letterId)) throw new Error(`duplicate_notification:${letterId}`)
    seenLetters.add(letterId)
    enumValue(document, 'status', NOTIFICATION_STATUSES, 'notificationJobs')
    nonNegativeInteger(document, 'attemptCount', 'notificationJobs')
    timestamp(document, 'availableAt')
  }
}

function assertChildOwnership(input: ConvexExport, letters: Map<string, LetterRecord>): void {
  const children: Array<{
    table: ConvexSourceTable
    rows: ConvexDocument[]
    letterField: string
  }> = [
    { table: 'letterContents', rows: input.letterContents ?? [], letterField: 'letterId' },
    { table: 'letterAttachments', rows: input.letterAttachments ?? [], letterField: 'letterId' },
    { table: 'letterDeliveries', rows: input.letterDeliveries ?? [], letterField: 'letterId' },
    { table: 'notificationJobs', rows: input.notificationJobs ?? [], letterField: 'letterId' },
  ]

  for (const child of children) {
    for (const document of child.rows) {
      const childId = requiredId(document, child.table)
      const letterId = requiredString(document, child.letterField, child.table)
      const ownerId = requiredString(document, 'ownerId', child.table)
      const letter = letters.get(letterId)
      if (letter && letter.ownerId !== ownerId) {
        throw new Error(`owner_mismatch:${child.table}:${childId}`)
      }
    }
  }
}

function assertPushReferences(documents: ConvexDocument[], userIds: Set<string>): void {
  const endpoints = new Set<string>()
  for (const document of documents) {
    const id = requiredId(document, 'pushSubscriptions')
    const ownerId = requiredString(document, 'ownerId', 'pushSubscriptions')
    const endpoint = requiredString(document, 'endpoint', 'pushSubscriptions')
    if (!userIds.has(ownerId)) throw new Error(`orphan_owner:pushSubscriptions:${id}`)
    assertHttpsPushEndpoint(endpoint, id)
    if (endpoints.has(endpoint)) throw new Error(`duplicate_push_endpoint:${id}`)
    endpoints.add(endpoint)
  }
}

function assertUserReferences(input: ConvexExport, userIds: Set<string>): void {
  for (const [table, rows] of [
    ['userSettings', input.userSettings ?? []],
    ['threads', input.threads ?? []],
    ['letters', input.letters ?? []],
    ['letterContents', input.letterContents ?? []],
    ['letterAttachments', input.letterAttachments ?? []],
    ['letterDeliveries', input.letterDeliveries ?? []],
    ['notificationJobs', input.notificationJobs ?? []],
    ['pushSubscriptions', input.pushSubscriptions ?? []],
  ] as Array<[string, ConvexDocument[]]>) {
    for (const row of rows) {
      const ownerId = optionalString(row, 'ownerId')
      const userId = optionalString(row, 'userId')
      const candidate = ownerId ?? userId
      if (candidate && !userIds.has(candidate)) {
        throw new Error(`orphan_owner:${table}:${requiredId(row, table)}`)
      }
    }
  }
}

function assertThreadReferences(input: ConvexExport, userIds: Set<string>): Map<string, string> {
  const threadOwners = new Map<string, string>()
  for (const thread of input.threads ?? []) {
    const id = requiredId(thread, 'threads')
    const ownerId = requiredString(thread, 'ownerId', 'threads')
    if (!userIds.has(ownerId)) throw new Error(`orphan_owner:threads:${id}`)
    threadOwners.set(id, ownerId)
  }
  for (const letter of input.letters ?? []) {
    const id = requiredId(letter, 'letters')
    const threadId = requiredString(letter, 'threadId', 'letters')
    if (!threadOwners.has(threadId)) throw new Error(`orphan_thread:letters:${id}`)
  }
  return threadOwners
}

function assertUniqueTokenIdentifiers(users: ConvexDocument[]): void {
  const identifiers = new Map<string, string>()
  for (const user of users) {
    const id = requiredId(user, 'users')
    const tokenIdentifier = requiredString(user, 'tokenIdentifier', 'users')
    const existing = identifiers.get(tokenIdentifier)
    if (existing && existing !== id) throw new Error(`identity_mapping_conflict:${tokenIdentifier}`)
    identifiers.set(tokenIdentifier, id)
  }
}

function assertUniqueForeignKey(
  documents: ConvexDocument[],
  field: string,
  table: ConvexSourceTable,
  errorCode: string,
): void {
  const values = new Set<string>()
  for (const document of documents) {
    const sourceId = requiredId(document, table)
    const value = requiredString(document, field, table)
    if (values.has(value)) throw new Error(`${errorCode}:${sourceId}`)
    values.add(value)
  }
}

function buildImportStatements(rows: ImportRow[], now: number | undefined): string[] {
  const statements: string[] = []
  const orderedRows = orderRowsForImport(rows)
  for (const row of orderedRows) {
    const columns = row.columns.map(quoteIdentifier).join(', ')
    const values = row.values
      .map((value, index) =>
        row.targetTable === 'letters' && row.columns[index] === 'next_letter_id' ? null : value,
      )
      .map(sqlLiteral)
      .join(', ')
    const conflict = quoteIdentifier(findConflictColumn(row.targetTable))
    const mapKey = `source_table = ${sqlLiteral(row.sourceTable)} AND source_id = ${sqlLiteral(row.sourceId)}`
    const matchingTarget = targetMatchCondition(row)
    const importedAt =
      now === undefined ? "CAST(strftime('%s', 'now') AS INTEGER) * 1000" : sqlLiteral(now)
    // Recover a target row left by a sequential CLI interruption only when the
    // import map agrees; a mismatched existing row deliberately causes a
    // unique-key failure in the next statement instead of being adopted.
    statements.push(
      `INSERT INTO ${quoteIdentifier(row.targetTable)} (${columns}) SELECT ${values} WHERE NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(row.targetTable)} WHERE ${conflict} = ${sqlLiteral(row.targetId)}) AND (NOT EXISTS (SELECT 1 FROM ${IMPORT_MAP_TABLE} WHERE ${mapKey}) OR EXISTS (SELECT 1 FROM ${IMPORT_MAP_TABLE} WHERE ${mapKey} AND target_id = ${sqlLiteral(row.targetId)} AND source_checksum = ${sqlLiteral(row.sourceChecksum)}));`,
    )
    statements.push(
      `INSERT INTO ${quoteIdentifier(row.targetTable)} (${columns}) SELECT ${values} WHERE NOT EXISTS (SELECT 1 FROM ${IMPORT_MAP_TABLE} WHERE ${mapKey}) AND EXISTS (SELECT 1 FROM ${quoteIdentifier(row.targetTable)} WHERE ${conflict} = ${sqlLiteral(row.targetId)}) AND NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(row.targetTable)} WHERE ${conflict} = ${sqlLiteral(row.targetId)} AND ${matchingTarget});`,
    )
    statements.push(
      `INSERT INTO ${IMPORT_MAP_TABLE} (source_table, source_id, target_id, source_checksum, imported_at) VALUES (${sqlLiteral(row.sourceTable)}, ${sqlLiteral(row.sourceId)}, ${sqlLiteral(row.targetId)}, ${sqlLiteral(row.sourceChecksum)}, ${importedAt}) ON CONFLICT (source_table, source_id) DO UPDATE SET target_id = excluded.target_id, source_checksum = excluded.source_checksum, imported_at = excluded.imported_at;`,
    )
  }

  for (const row of orderedRows.filter((candidate) => candidate.targetTable === 'letters')) {
    const nextLetterId = valueForColumn(row, 'next_letter_id')
    statements.push(
      `UPDATE ${quoteIdentifier('letters')} SET ${quoteIdentifier('next_letter_id')} = ${sqlLiteral(nextLetterId)} WHERE ${quoteIdentifier('id')} = ${sqlLiteral(row.targetId)} AND EXISTS (SELECT 1 FROM ${IMPORT_MAP_TABLE} WHERE source_table = ${sqlLiteral(row.sourceTable)} AND source_id = ${sqlLiteral(row.sourceId)} AND target_id = ${sqlLiteral(row.targetId)} AND source_checksum = ${sqlLiteral(row.sourceChecksum)});`,
    )
  }
  return statements
}

function targetMatchCondition(row: ImportRow): string {
  return row.columns
    .map((column, index) => {
      const value = sqlLiteral(row.values[index])
      if (row.targetTable === 'letters' && column === 'next_letter_id') {
        return `(${quoteIdentifier(column)} IS NULL OR ${quoteIdentifier(column)} IS ${value})`
      }
      return `${quoteIdentifier(column)} IS ${value}`
    })
    .join(' AND ')
}

function buildRollbackStatements(rows: ImportRow[], r2Objects: R2MigrationObject[]): string[] {
  const statements: string[] = []
  const orderedRows = orderRowsForImport(rows)

  for (const row of orderedRows.filter((candidate) => candidate.targetTable === 'letters')) {
    statements.push(
      `UPDATE ${quoteIdentifier('letters')} SET ${quoteIdentifier('next_letter_id')} = NULL WHERE ${quoteIdentifier('id')} = ${sqlLiteral(row.targetId)} AND EXISTS (SELECT 1 FROM ${IMPORT_MAP_TABLE} WHERE source_table = ${sqlLiteral(row.sourceTable)} AND source_id = ${sqlLiteral(row.sourceId)} AND target_id = ${sqlLiteral(row.targetId)} AND source_checksum = ${sqlLiteral(row.sourceChecksum)});`,
    )
  }

  for (const table of [...IMPORT_TABLES].reverse()) {
    const tableRows = orderedRows.filter((row) => row.targetTable === table.target).reverse()
    for (const row of tableRows) {
      const conflict = quoteIdentifier(findConflictColumn(row.targetTable))
      statements.push(
        `DELETE FROM ${quoteIdentifier(row.targetTable)} WHERE ${conflict} = ${sqlLiteral(row.targetId)} AND EXISTS (SELECT 1 FROM ${IMPORT_MAP_TABLE} WHERE source_table = ${sqlLiteral(row.sourceTable)} AND source_id = ${sqlLiteral(row.sourceId)} AND target_id = ${sqlLiteral(row.targetId)} AND source_checksum = ${sqlLiteral(row.sourceChecksum)});`,
      )
    }
  }
  for (const row of [...orderedRows].reverse()) {
    statements.push(
      `DELETE FROM ${IMPORT_MAP_TABLE} WHERE source_table = ${sqlLiteral(row.sourceTable)} AND source_id = ${sqlLiteral(row.sourceId)} AND source_checksum = ${sqlLiteral(row.sourceChecksum)};`,
    )
  }
  for (const object of r2Objects) {
    statements.push(`-- R2 rollback object (Human Gate): ${object.targetKey}`)
  }
  return statements
}

function orderRowsForImport(rows: ImportRow[]): ImportRow[] {
  const letterRows = rows.filter((row) => row.targetTable === 'letters')
  if (letterRows.length < 2) return rows

  const byId = new Map(letterRows.map((row) => [row.targetId, row]))
  const depths = new Map<string, number>()
  const visiting = new Set<string>()

  const depthFor = (row: ImportRow): number => {
    const knownDepth = depths.get(row.targetId)
    if (knownDepth !== undefined) return knownDepth
    if (visiting.has(row.targetId)) throw new Error(`letter_parent_cycle:${row.targetId}`)
    visiting.add(row.targetId)
    const parentId = valueForColumn(row, 'parent_letter_id')
    const parent = parentId === null ? undefined : byId.get(parentId)
    const depth = parent ? depthFor(parent) + 1 : 0
    visiting.delete(row.targetId)
    depths.set(row.targetId, depth)
    return depth
  }

  const orderedLetters = [...letterRows].sort(
    (left, right) =>
      depthFor(left) - depthFor(right) || left.targetId.localeCompare(right.targetId),
  )
  let letterIndex = 0
  return rows.map((row) => {
    if (row.targetTable !== 'letters') return row
    const replacement = orderedLetters[letterIndex]
    letterIndex += 1
    return replacement
  })
}

function valueForColumn(row: ImportRow, column: string): string | null {
  const index = row.columns.indexOf(column)
  const value = row.values[index]
  if (typeof value !== 'string' && value !== null) {
    throw new Error(`migration_column_value_invalid:${row.targetTable}:${column}`)
  }
  return value
}

function countRows(rows: ImportRow[]): Record<string, number> {
  const counts = Object.fromEntries(IMPORT_TABLES.map(({ target }) => [target, 0]))
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.targetTable] = (counts[row.targetTable] ?? 0) + 1
    return counts
  }, counts)
}

function findConflictColumn(table: string): string {
  return IMPORT_TABLES.find((entry) => entry.target === table)?.conflictColumn ?? 'id'
}

function collectUniqueIds(documents: ConvexDocument[], table: string): Set<string> {
  const ids = new Set<string>()
  for (const document of documents) {
    const id = requiredId(document, table)
    if (ids.has(id)) throw new Error(`duplicate_id:${table}:${id}`)
    ids.add(id)
  }
  return ids
}

function requiredId(document: ConvexDocument, table: string): string {
  return requiredString(document, '_id', table)
}

function requiredString(document: ConvexDocument, field: string, table: string): string {
  const value = document[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`required_string_missing:${table}:${field}`)
  }
  return value
}

function optionalString(document: ConvexDocument, field: string): string | null {
  const value = document[field]
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new Error(`invalid_string:${field}`)
  return value
}

function requiredBoolean(document: ConvexDocument, field: string, table: string): boolean {
  const value = document[field]
  if (typeof value !== 'boolean') throw new Error(`required_boolean_missing:${table}:${field}`)
  return value
}

function booleanInteger(document: ConvexDocument, field: string, fallback: boolean): number {
  const value = document[field]
  if (value === undefined || value === null) return fallback ? 1 : 0
  if (typeof value !== 'boolean') throw new Error(`invalid_boolean:${field}`)
  return value ? 1 : 0
}

function requiredBody(document: ConvexDocument): string {
  const body = document.body
  if (typeof body !== 'string') throw new Error('required_string_missing:letterContents:body')
  if (body.length > 20_000) throw new Error('letter_body_too_long')
  return body
}

function integer(document: ConvexDocument, field: string, table: string): number {
  const value = document[field]
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`required_integer_invalid:${table}:${field}`)
  }
  return value
}

function nonNegativeInteger(document: ConvexDocument, field: string, table: string): number {
  const value = integer(document, field, table)
  if (value < 0) throw new Error(`negative_integer:${table}:${field}`)
  return value
}

function optionalInteger(document: ConvexDocument, field: string): number | null {
  const value = document[field]
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value))
    throw new Error(`invalid_integer:${field}`)
  return value
}

function timestamp(document: ConvexDocument, ...fields: string[]): number {
  for (const field of fields) {
    const value = document[field]
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`invalid_timestamp:${field}`)
      }
      return value
    }
  }
  throw new Error(`timestamp_missing:${fields[0]}`)
}

function optionalTimestamp(document: ConvexDocument, field: string): number | null {
  const value = document[field]
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid_timestamp:${field}`)
  }
  return value
}

function enumValue(
  document: ConvexDocument,
  field: string,
  values: Set<string>,
  table: string,
): string {
  const value = requiredString(document, field, table)
  if (!values.has(value)) throw new Error(`invalid_enum:${table}:${field}:${value}`)
  return value
}

function optionalEnum(document: ConvexDocument, field: string, values: Set<string>): string | null {
  const value = optionalString(document, field)
  if (value !== null && !values.has(value)) throw new Error(`invalid_enum:${field}:${value}`)
  return value
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('canonical_json_unsupported')
  return serialized
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function checksumWithTargetMapping(
  document: ConvexDocument,
  targetMapping: Record<string, SqlValue>,
): string {
  return sha256(canonicalJson({ source: document, targetMapping }))
}

function assertHttpsPushEndpoint(endpoint: string, sourceId: string): void {
  try {
    const parsed = new URL(endpoint)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
      throw new Error('invalid')
  } catch {
    throw new Error(`push_endpoint_invalid:${sourceId}`)
  }
}

function sqlLiteral(value: SqlValue): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function sanitizeCutoverId(value: string): string {
  const normalized = value.trim()
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(normalized)) throw new Error('r2_cutover_id_invalid')
  return normalized
}

function safePathSegment(value: string): string {
  const encoded = encodeURIComponent(value)
  if (encoded === '.' || encoded === '..') throw new Error('r2_source_id_invalid')
  return encoded
}

function asDocument(value: unknown, source: string): ConvexDocument {
  if (!isRecord(value) || Array.isArray(value)) throw new Error(`document_must_be_object:${source}`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isConvexSourceTable(value: string): value is ConvexSourceTable {
  return (CONVEX_SOURCE_TABLES as readonly string[]).includes(value)
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function isDirectory(value: string): boolean {
  try {
    return statSync(value).isDirectory()
  } catch {
    return false
  }
}

function parseCliArguments(args: string[]): {
  input: string
  table?: ConvexSourceTable
  output?: string
  rollbackOutput?: string
  manifestOutput?: string
  environment: MigrationEnvironment
  mode: MigrationMode
  humanGate: boolean
  r2CutoverId?: string
} {
  const result: {
    input: string
    table?: ConvexSourceTable
    output?: string
    rollbackOutput?: string
    manifestOutput?: string
    environment: MigrationEnvironment
    mode: MigrationMode
    humanGate: boolean
    r2CutoverId?: string
  } = { input: '', environment: 'local', mode: 'dry-run', humanGate: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]
    if (arg === '--input') {
      result.input = next ?? ''
      index += 1
    } else if (arg === '--table') {
      if (!next || !isConvexSourceTable(next)) throw new Error('migration_table_invalid')
      result.table = next
      index += 1
    } else if (arg === '--output') {
      result.output = next ?? ''
      index += 1
    } else if (arg === '--rollback-output') {
      result.rollbackOutput = next ?? ''
      index += 1
    } else if (arg === '--manifest-output') {
      result.manifestOutput = next ?? ''
      index += 1
    } else if (arg === '--environment') {
      if (next !== 'local' && next !== 'preview' && next !== 'production') {
        throw new Error('migration_environment_invalid')
      }
      result.environment = next
      index += 1
    } else if (arg === '--sql') {
      result.mode = 'sql'
    } else if (arg === '--human-gate') {
      result.humanGate = true
    } else if (arg === '--r2-cutover-id') {
      result.r2CutoverId = next ?? ''
      index += 1
    } else if (arg === '--help') {
      printUsage()
      process.exit(0)
    } else {
      throw new Error(`unknown_argument:${arg}`)
    }
  }

  if (!result.input) throw new Error('migration_input_required')
  if (result.mode === 'sql' && !result.output) throw new Error('migration_output_required_for_sql')
  return result
}

function printUsage(): void {
  console.log(`Usage: node scripts/convex-to-d1-migration.ts --input <file-or-directory> [options]

Default mode validates and prints a dry-run summary. It never writes to D1/R2.
  --table <table>             Table name when --input is a single JSON array/JSONL file
  --sql                       Emit idempotent D1 SQL (requires --output)
  --output <file>             Import SQL output path
  --rollback-output <file>   Rollback SQL output path
  --manifest-output <file>   JSON manifest output path
  --environment local|preview|production
  --human-gate                 Explicit gate for production SQL generation
  --r2-cutover-id <id>        Immutable R2 target prefix identifier
`)
}

function runCli(): void {
  const options = parseCliArguments(process.argv.slice(2))
  const input = loadConvexExport(options.input, options.table)
  const plan = buildMigrationPlan(input, {
    environment: options.environment,
    mode: options.mode,
    humanGate: options.humanGate,
    r2CutoverId: options.r2CutoverId,
  })

  if (options.mode === 'dry-run') {
    console.log(
      JSON.stringify(
        {
          mode: plan.mode,
          environment: plan.environment,
          sourceChecksum: plan.sourceChecksum,
          counts: plan.counts,
          r2Objects: plan.r2Objects.length,
          warnings: plan.warnings,
        },
        null,
        2,
      ),
    )
    return
  }

  writeArtifact(options.output as string, buildImportSql(plan))
  if (options.rollbackOutput) writeArtifact(options.rollbackOutput, buildRollbackSql(plan))
  if (options.manifestOutput) {
    writeArtifact(
      options.manifestOutput,
      JSON.stringify(
        {
          environment: plan.environment,
          sourceChecksum: plan.sourceChecksum,
          counts: plan.counts,
          r2Objects: plan.r2Objects,
          warnings: plan.warnings,
        },
        null,
        2,
      ),
    )
  }
  console.log(`generated D1 SQL: ${basename(options.output as string)}`)
}

function writeArtifact(filePath: string, contents: string): void {
  const absolutePath = resolve(filePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, contents, 'utf8')
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
const modulePath = resolve(fileURLToPath(import.meta.url))
if (invokedPath === modulePath) {
  try {
    runCli()
  } catch (error) {
    console.error(`CONVEX_TO_D1_MIGRATION status: FAIL`)
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
