import { describe, expect, it } from 'vitest'

import {
  assertPublicPayloadHidesSchedule,
  buildIdentityMap,
  canReadSealedBody,
  checksumDrift,
  convexTokenIdentifier,
  decideMigrationNecessity,
  deriveNextLetterId,
  publicLetterPayload,
  requiresHumanGate,
  timestamptzToEpochMs,
} from '../../scripts/legacy-migration-mapping'

describe('legacy migration mapping', () => {
  it('records no production import when the production stack is unprovisioned', () => {
    expect(
      decideMigrationNecessity({
        productionStackProvisioned: false,
        productionUserOrLetterRows: 0,
        gitHasLegacyMigrations: true,
        gitHasProductionDump: false,
      }),
    ).toBe('no_production_import')
  })

  it('requires import when a production dump or live production rows exist', () => {
    expect(
      decideMigrationNecessity({
        productionStackProvisioned: true,
        productionUserOrLetterRows: 3,
        gitHasLegacyMigrations: true,
        gitHasProductionDump: false,
      }),
    ).toBe('import_required')
    expect(
      decideMigrationNecessity({
        productionStackProvisioned: false,
        productionUserOrLetterRows: 2,
        gitHasLegacyMigrations: true,
        gitHasProductionDump: false,
      }),
    ).toBe('import_required')
    expect(
      decideMigrationNecessity({
        productionStackProvisioned: false,
        productionUserOrLetterRows: 0,
        gitHasLegacyMigrations: true,
        gitHasProductionDump: true,
      }),
    ).toBe('import_required')
  })

  it('maps a Supabase user to a Convex tokenIdentifier without using the UUID as owner id', () => {
    const mapped = buildIdentityMap([
      {
        supabaseUserId: '11111111-1111-1111-1111-111111111111',
        auth0Issuer: 'https://re-me-dev.auth0.com/',
        auth0Sub: 'google-oauth2|abc',
      },
    ])

    expect(mapped.get('11111111-1111-1111-1111-111111111111')).toBe(
      'https://re-me-dev.auth0.com|google-oauth2|abc',
    )
    expect(convexTokenIdentifier('https://re-me-dev.auth0.com', 'auth0|db-user')).toBe(
      'https://re-me-dev.auth0.com|auth0|db-user',
    )
  })

  it('derives a single next letter from parent_letter_id and rejects branches', () => {
    expect(
      deriveNextLetterId([
        { id: 'root', parentLetterId: null },
        { id: 'reply', parentLetterId: 'root' },
      ]).get('root'),
    ).toBe('reply')
    expect(() =>
      deriveNextLetterId([
        { id: 'a', parentLetterId: 'root' },
        { id: 'b', parentLetterId: 'root' },
      ]),
    ).toThrowError('branching_thread_unsupported')
  })

  it('keeps sealed body unreadable until delivered and opened', () => {
    expect(
      canReadSealedBody({
        sealed: true,
        status: 'traveling',
        openedAt: null,
        deletedAt: null,
      }),
    ).toBe(false)
    expect(
      canReadSealedBody({
        sealed: true,
        status: 'delivered',
        openedAt: null,
        deletedAt: null,
      }),
    ).toBe(false)
    expect(
      canReadSealedBody({
        sealed: true,
        status: 'delivered',
        openedAt: 1,
        deletedAt: null,
      }),
    ).toBe(true)
  })

  it('preserves exact schedule in private mapping but strips it from public payloads', () => {
    const scheduledAt = timestamptzToEpochMs('2026-08-29T04:00:00.000Z')
    const payload = publicLetterPayload({
      letterId: 'letter-1',
      status: 'traveling',
      sealed: true,
      scheduledAt,
    })

    expect(scheduledAt).toBe(Date.UTC(2026, 7, 29, 4, 0, 0))
    expect(timestamptzToEpochMs('2026-08-29 13:00:00+09')).toBe(scheduledAt)
    expect(timestamptzToEpochMs('2026-08-29T04:00:00+00:00')).toBe(scheduledAt)
    expect(() => timestamptzToEpochMs('2026-08-29T04:00:00')).toThrowError(
      'timestamp_missing_offset',
    )
    expect(payload).not.toHaveProperty('scheduledAt')
    expect(() => assertPublicPayloadHidesSchedule(payload)).not.toThrow()
    expect(() => assertPublicPayloadHidesSchedule({ ...payload, scheduledAt })).toThrowError(
      'scheduled_at_leaked',
    )
  })

  it('reports checksum drift and classifies destructive production ops as Human Gate', () => {
    expect(
      checksumDrift(
        {
          users: 1,
          threads: 1,
          letters: 2,
          letterContents: 2,
          letterDeliveries: 1,
          photoAttachmentsWithObject: 1,
        },
        {
          users: 1,
          threads: 1,
          letters: 1,
          letterContents: 2,
          letterDeliveries: 1,
          photoAttachmentsWithObject: 1,
        },
      ),
    ).toEqual(['letters'])
    expect(requiresHumanGate('production_import')).toBe(true)
    expect(requiresHumanGate('legacy_production_deletion')).toBe(true)
    expect(requiresHumanGate('local_schema_compare')).toBe(false)
  })
})
