import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertExecutionAllowed,
  assertPublicProjectionHidesPrivateFields,
  buildImportSql,
  buildMigrationPlan,
  buildRollbackSql,
  canReadMigratedContent,
  parseJsonLines,
  parseTableExport,
  toPublicLetterMetadata,
  type ConvexDocument,
  type ConvexExport,
} from '../../scripts/convex-to-d1-migration'

const baseTime = 1_700_000_000_000

function makeLetter(id = 'letter-1', overrides: Partial<ConvexDocument> = {}): ConvexDocument {
  return {
    _id: id,
    _creationTime: baseTime,
    threadId: 'thread-1',
    ownerId: 'user-1',
    parentLetterId: null,
    status: 'traveling',
    sealed: true,
    deliveryMode: 'few_days',
    deliveryWindowStart: baseTime + 86_400_000,
    deliveryWindowEnd: baseTime + 172_800_000,
    sentAt: baseTime,
    deliveredAt: null,
    openedAt: null,
    repliedAt: null,
    createdAt: baseTime,
    updatedAt: baseTime,
    deletedAt: null,
    ...overrides,
  }
}

function makeDraftLetter(id: string, parentLetterId: string): ConvexDocument {
  return makeLetter(id, {
    parentLetterId,
    status: 'draft',
    sealed: false,
    deliveryMode: null,
    deliveryWindowStart: null,
    deliveryWindowEnd: null,
    sentAt: null,
    deliveredAt: null,
  })
}

function makeExport(): ConvexExport {
  return {
    users: [
      {
        _id: 'user-1',
        _creationTime: baseTime,
        tokenIdentifier: 'auth0|user-1',
        email: 'user@example.com',
        name: 'Re:Me user',
        pictureUrl: null,
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ],
    userSettings: [
      {
        _id: 'settings-1',
        _creationTime: baseTime,
        userId: 'user-1',
        timezone: 'Asia/Tokyo',
        pushEnabled: true,
        emailNotificationEnabled: false,
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ],
    threads: [
      {
        _id: 'thread-1',
        _creationTime: baseTime,
        ownerId: 'user-1',
        createdAt: baseTime,
        updatedAt: baseTime,
        deletedAt: null,
      },
    ],
    letters: [makeLetter()],
    letterContents: [
      {
        _id: 'content-1',
        _creationTime: baseTime,
        letterId: 'letter-1',
        ownerId: 'user-1',
        body: '未来の自分へ',
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ],
    letterAttachments: [
      {
        _id: 'attachment-1',
        _creationTime: baseTime,
        letterId: 'letter-1',
        ownerId: 'user-1',
        kind: 'photo',
        status: 'ready',
        r2ObjectId: 'letters/letter-1/source.jpg',
        contentEtag: 'etag-1',
        mimeType: 'image/jpeg',
        byteSize: 1234,
        width: 100,
        height: 80,
        generationToken: 'attachment-generation-1',
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ],
    attachmentFinalizationAttempts: [
      {
        _id: 'finalization-1',
        _creationTime: baseTime,
        attachmentId: 'attachment-1',
        generationToken: 'attachment-generation-1',
        runnerToken: 'runner-1',
        objectKey: 'letters/letter-1/candidate.jpg',
        state: 'deleting',
        deleteAttemptCount: 0,
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ],
    letterDeliveries: [
      {
        _id: 'delivery-1',
        _creationTime: baseTime,
        letterId: 'letter-1',
        ownerId: 'user-1',
        scheduledAt: baseTime + 86_400_000,
        status: 'pending',
        attemptCount: 0,
        lastAttemptAt: null,
        createdAt: baseTime,
      },
    ],
    notificationJobs: [
      {
        _id: 'notification-1',
        _creationTime: baseTime,
        letterId: 'letter-1',
        ownerId: 'user-1',
        status: 'pending',
        attemptCount: 0,
        generationToken: 'notification-generation-1',
        availableAt: baseTime + 86_400_000,
        lockedAt: null,
        sentAt: null,
        lastErrorCode: null,
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ],
    pushSubscriptions: [
      {
        _id: 'push-1',
        _creationTime: baseTime,
        ownerId: 'user-1',
        endpoint: 'https://push.example/subscription-1',
        p256dh: 'p256dh',
        auth: 'auth',
        userAgent: 'test',
        createdAt: baseTime,
        updatedAt: baseTime,
        disabledAt: null,
      },
    ],
  }
}

function makeReplyExport(): ConvexExport {
  const replyExport = makeExport()
  replyExport.letters = [
    makeLetter('z-parent', { status: 'delivered', deliveredAt: baseTime + 200 }),
    makeDraftLetter('a-child', 'z-parent'),
  ]
  replyExport.letterContents = [
    {
      _id: 'content-parent',
      _creationTime: baseTime,
      letterId: 'z-parent',
      ownerId: 'user-1',
      body: '親',
      createdAt: baseTime,
      updatedAt: baseTime,
    },
    {
      _id: 'content-child',
      _creationTime: baseTime,
      letterId: 'a-child',
      ownerId: 'user-1',
      body: '',
      createdAt: baseTime,
      updatedAt: baseTime,
    },
  ]
  replyExport.letterAttachments = []
  replyExport.attachmentFinalizationAttempts = []
  replyExport.letterDeliveries = [
    { ...replyExport.letterDeliveries![0], letterId: 'z-parent', status: 'consumed' },
  ]
  replyExport.notificationJobs = [{ ...replyExport.notificationJobs![0], letterId: 'z-parent' }]
  return replyExport
}

function openMigrationDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:')
  database.exec(readFileSync(resolve('migrations/0001_initial_schema.sql'), 'utf8'))
  return database
}

function executeStatements(database: DatabaseSync, statements: string[]): void {
  for (const statement of statements) database.exec(statement)
}

function countRows(database: DatabaseSync, table: string): number {
  const result = database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as {
    count: number
  }
  return result.count
}

describe('Convex to D1 migration plan', () => {
  it('maps the full export while keeping private fields out of public metadata', () => {
    const plan = buildMigrationPlan(makeExport(), {
      now: baseTime + 1,
      r2CutoverId: 'rehearsal-1',
    })

    expect(plan.counts).toEqual({
      users: 1,
      user_settings: 1,
      threads: 1,
      letters: 1,
      letter_contents: 1,
      letter_attachments: 1,
      attachment_finalization_attempts: 1,
      letter_deliveries: 1,
      notification_jobs: 1,
      push_subscriptions: 1,
    })
    expect(plan.r2Objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: 'letters/letter-1/source.jpg',
          targetKey: 'migration/rehearsal-1/attachments/attachment-1.jpg',
          contentEtag: 'etag-1',
        }),
        expect.objectContaining({
          sourceKey: 'letters/letter-1/candidate.jpg',
          targetKey: 'migration/rehearsal-1/finalization/attachment-1/finalization-1.jpg',
        }),
      ]),
    )

    const importSql = buildImportSql(plan)
    const rollbackSql = buildRollbackSql(plan)
    expect(importSql).toContain('WHERE NOT EXISTS')
    expect(importSql).toContain('migration_import_keys')
    expect(importSql).not.toContain('BEGIN;')
    expect(rollbackSql).toContain('source_checksum')
    expect(rollbackSql).toContain('R2 rollback object (Human Gate)')

    const letter = makeLetter()
    const metadata = toPublicLetterMetadata({
      id: 'letter-1',
      threadId: 'thread-1',
      ownerId: 'user-1',
      parentLetterId: null,
      nextLetterId: null,
      status: 'traveling',
      sealed: true,
      deliveryMode: 'few_days',
      deliveryWindowStart: letter.deliveryWindowStart as number,
      deliveryWindowEnd: letter.deliveryWindowEnd as number,
      sentAt: baseTime,
      deliveredAt: null,
      openedAt: null,
      repliedAt: null,
      createdAt: baseTime,
      updatedAt: baseTime,
      deletedAt: null,
    })
    assertPublicProjectionHidesPrivateFields(metadata)
    expect(metadata).not.toHaveProperty('scheduledAt')
    expect(
      canReadMigratedContent({
        status: 'traveling',
        sealed: true,
        openedAt: null,
        deletedAt: null,
      }),
    ).toBe(false)
    expect(
      canReadMigratedContent({ status: 'draft', sealed: true, openedAt: null, deletedAt: null }),
    ).toBe(true)
  })

  it('produces the same import artifact for the same source and rejects production without a gate', () => {
    expect(() => buildMigrationPlan(makeExport(), { mode: 'sql' })).toThrow(
      'r2_cutover_id_required_for_sql',
    )
    const first = buildMigrationPlan(makeExport(), {
      r2CutoverId: 'rehearsal-1',
    })
    const second = buildMigrationPlan(makeExport(), {
      r2CutoverId: 'rehearsal-1',
    })
    expect(second.sourceChecksum).toBe(first.sourceChecksum)
    expect(second.statements).toEqual(first.statements)

    const alternateDatabase = openMigrationDatabase()
    executeStatements(alternateDatabase, first.statements)
    const alternate = buildMigrationPlan(makeExport(), {
      now: baseTime + 1,
      r2CutoverId: 'rehearsal-sqlite-alternate',
    })
    expect(() => executeStatements(alternateDatabase, alternate.statements)).toThrow(
      'migration_checksum_drift',
    )
    alternateDatabase.close()

    expect(() => assertExecutionAllowed('production', 'sql')).toThrow(
      'production_human_gate_required',
    )
    expect(() => assertExecutionAllowed('production', 'dry-run')).not.toThrow()
    expect(() => assertExecutionAllowed('production', 'sql', true)).not.toThrow()
  })

  it('imports reply parents before children and finalizes next links after all letters exist', () => {
    const plan = buildMigrationPlan(makeReplyExport(), {
      now: baseTime + 1,
      r2CutoverId: 'rehearsal-1',
    })
    const importSql = buildImportSql(plan)
    const rollbackSql = buildRollbackSql(plan)

    expect(importSql.indexOf("'z-parent'")).toBeLessThan(importSql.indexOf("'a-child'"))
    expect(importSql).toContain('UPDATE "letters" SET "next_letter_id" =')
    expect(rollbackSql).toContain('UPDATE "letters" SET "next_letter_id" = NULL')
    expect(rollbackSql.indexOf(`DELETE FROM "letters" WHERE "id" = 'a-child'`)).toBeLessThan(
      rollbackSql.indexOf(`DELETE FROM "letters" WHERE "id" = 'z-parent'`),
    )
  })

  it('executes import twice, rejects checksum drift, and rolls back a reply chain in SQLite', () => {
    const plan = buildMigrationPlan(makeExport(), {
      now: baseTime + 1,
      r2CutoverId: 'rehearsal-sqlite',
    })
    const database = openMigrationDatabase()

    executeStatements(database, plan.statements)
    const firstCounts = Object.fromEntries(
      Object.keys(plan.counts).map((table) => [table, countRows(database, table)]),
    )
    expect(firstCounts).toEqual(plan.counts)

    executeStatements(database, plan.statements)
    const secondCounts = Object.fromEntries(
      Object.keys(plan.counts).map((table) => [table, countRows(database, table)]),
    )
    expect(secondCounts).toEqual(firstCounts)
    expect(countRows(database, 'migration_import_keys')).toBe(plan.rows.length)
    expect(() =>
      database
        .prepare(
          "UPDATE migration_import_keys SET source_checksum = 'changed' WHERE source_table = 'users' AND source_id = 'user-1'",
        )
        .run(),
    ).toThrow('migration_checksum_drift')
    executeStatements(database, plan.rollbackStatements)
    expect(Object.keys(plan.counts).every((table) => countRows(database, table) === 0)).toBe(true)
    expect(countRows(database, 'migration_import_keys')).toBe(0)
    database.close()

    const replyPlan = buildMigrationPlan(makeReplyExport(), {
      now: baseTime + 1,
      r2CutoverId: 'rehearsal-sqlite-reply',
    })
    const replyDatabase = openMigrationDatabase()
    executeStatements(replyDatabase, replyPlan.statements)
    expect(
      replyDatabase
        .prepare('SELECT parent_letter_id, next_letter_id FROM letters WHERE id = ?')
        .get('z-parent'),
    ).toEqual({ parent_letter_id: null, next_letter_id: 'a-child' })
    executeStatements(replyDatabase, replyPlan.statements)
    executeStatements(replyDatabase, replyPlan.rollbackStatements)
    expect(countRows(replyDatabase, 'letters')).toBe(0)
    expect(countRows(replyDatabase, 'migration_import_keys')).toBe(0)
    replyDatabase.close()
  })

  it('rejects orphan, state, and branching data before SQL generation', () => {
    const orphan = makeExport()
    orphan.letterContents = [{ ...orphan.letterContents![0], ownerId: 'missing-user' }]
    expect(() => buildMigrationPlan(orphan)).toThrow('orphan_owner:letterContents:content-1')

    const threadOwnerMismatch = makeExport()
    threadOwnerMismatch.users = [
      ...threadOwnerMismatch.users!,
      {
        _id: 'user-2',
        _creationTime: baseTime,
        tokenIdentifier: 'auth0|user-2',
        email: 'other@example.com',
        name: 'Other user',
        pictureUrl: null,
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ]
    threadOwnerMismatch.threads = [{ ...threadOwnerMismatch.threads![0], ownerId: 'user-2' }]
    expect(() => buildMigrationPlan(threadOwnerMismatch)).toThrow(
      'letter_thread_owner_mismatch:letter-1',
    )

    const invalidWindow = makeExport()
    invalidWindow.letters = [
      makeLetter('letter-1', {
        deliveryWindowStart: baseTime + 10,
        deliveryWindowEnd: baseTime,
      }),
    ]
    expect(() => buildMigrationPlan(invalidWindow)).toThrow(
      'delivery_window_order_invalid:letter-1',
    )

    const consumedTraveling = makeExport()
    consumedTraveling.letterDeliveries = [
      { ...consumedTraveling.letterDeliveries![0], status: 'consumed' },
    ]
    expect(() => buildMigrationPlan(consumedTraveling)).toThrow(
      'delivery_state_mismatch:delivery-1:traveling:consumed',
    )

    const openedTraveling = makeExport()
    openedTraveling.letters = [makeLetter('letter-1', { openedAt: baseTime + 1 })]
    expect(() => buildMigrationPlan(openedTraveling)).toThrow('opened_state_inconsistent:letter-1')

    const emptySent = makeExport()
    emptySent.letterContents = [{ ...emptySent.letterContents![0], body: '' }]
    expect(() => buildMigrationPlan(emptySent)).toThrow('sent_letter_body_empty:letter-1')

    const wrongFinalizationKind = makeExport()
    wrongFinalizationKind.letterAttachments = [
      { ...wrongFinalizationKind.letterAttachments![0], kind: 'location', locationLabel: '東京' },
    ]
    expect(() => buildMigrationPlan(wrongFinalizationKind)).toThrow(
      'finalization_photo_required:finalization-1',
    )

    const wrongFinalizationGeneration = makeExport()
    wrongFinalizationGeneration.letterAttachments = [
      { ...wrongFinalizationGeneration.letterAttachments![0], generationToken: 'other-token' },
    ]
    expect(() => buildMigrationPlan(wrongFinalizationGeneration)).toThrow(
      'finalization_generation_mismatch:finalization-1',
    )

    const insecurePush = makeExport()
    insecurePush.pushSubscriptions = [
      { ...insecurePush.pushSubscriptions![0], endpoint: 'http://push.example/subscription-1' },
    ]
    expect(() => buildMigrationPlan(insecurePush)).toThrow('push_endpoint_invalid:push-1')

    const duplicatePush = makeExport()
    duplicatePush.pushSubscriptions = [
      ...duplicatePush.pushSubscriptions!,
      { ...duplicatePush.pushSubscriptions![0], _id: 'push-2' },
    ]
    expect(() => buildMigrationPlan(duplicatePush)).toThrow('duplicate_push_endpoint:push-2')
    expect(() => buildMigrationPlan(duplicatePush)).not.toThrow('https://push.example')

    const branching = makeExport()
    branching.letters = [
      makeLetter('letter-1', { status: 'delivered', deliveredAt: baseTime + 200 }),
      makeDraftLetter('letter-2', 'letter-1'),
      makeDraftLetter('letter-3', 'letter-1'),
    ]
    branching.letterContents = [
      ...branching.letterContents!,
      {
        _id: 'content-2',
        _creationTime: baseTime,
        letterId: 'letter-2',
        ownerId: 'user-1',
        body: '',
        createdAt: baseTime,
        updatedAt: baseTime,
      },
      {
        _id: 'content-3',
        _creationTime: baseTime,
        letterId: 'letter-3',
        ownerId: 'user-1',
        body: '返信',
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    ]
    expect(() => buildMigrationPlan(branching)).toThrow('branching_thread_unsupported:letter-1')
  })

  it('parses JSONL and rejects malformed records', () => {
    const row = JSON.stringify({ _id: 'user-1', _creationTime: baseTime })
    expect(parseJsonLines(`${row}\n`, 'users')).toEqual([JSON.parse(row)])
    expect(parseTableExport(`[${row}]`, 'users')).toEqual({ users: [JSON.parse(row)] })
    expect(parseTableExport(row, 'users')).toEqual({ users: [JSON.parse(row)] })
    expect(() => parseTableExport(row)).toThrow('export_root_has_no_known_tables')
    expect(() => parseJsonLines('{not-json}', 'users')).toThrow('invalid_json_line:users:1')
    expect(() => parseTableExport('{"users":{}}')).toThrow('table_must_be_array:users')
  })
})
