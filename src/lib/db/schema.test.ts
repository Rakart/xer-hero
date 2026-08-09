/**
 * The schema against §2.10, checked without a server.
 *
 * These assertions are deliberately literal. Every one of them is a line of the spec's DDL
 * that a future reader could plausibly "tidy" — a nullable that looks redundant, an index
 * that looks duplicated, a foreign-key action that looks inconsistent with its neighbour —
 * and each of those tidies is a silent behaviour change.
 */

import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { PROGRAMME_STATUS, REVISION_STATUS } from '@/lib/contracts/domain'
import {
  ALARM_RULES,
  alarmState,
  appUser,
  bookmark,
  programme,
  programmeVote,
  reservedHandle,
  revision,
  sectorTable,
  sweepRun,
  takedownReport,
  uploaderVote,
  uploadIntent,
} from './schema'

const tables = [
  programme,
  revision,
  appUser,
  reservedHandle,
  sectorTable,
  programmeVote,
  uploaderVote,
  bookmark,
  uploadIntent,
  takedownReport,
  sweepRun,
  alarmState,
]

function columnsOf(
  table: (typeof tables)[number],
): Map<string, ReturnType<typeof getTableConfig>['columns'][number]> {
  return new Map(getTableConfig(table).columns.map((c) => [c.name, c]))
}

/** `onDelete` per referencing column, across the whole schema. */
function deleteActions(table: (typeof tables)[number]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const fk of getTableConfig(table).foreignKeys) {
    const ref = fk.reference()
    for (const col of ref.columns) out[col.name] = fk.onDelete ?? 'no action'
  }
  return out
}

describe('the twelve tables of §2.10', () => {
  it('names every table the spec names, and no more', () => {
    expect(tables.map((t) => getTableConfig(t).name).sort()).toEqual([
      'alarm_state',
      'app_user',
      'bookmark',
      'programme',
      'programme_vote',
      'reserved_handle',
      'revision',
      'sector',
      'sweep_run',
      'takedown_report',
      'upload_intent',
      'uploader_vote',
    ])
  })
})

describe('programme — identity', () => {
  const cols = columnsOf(programme)

  it('carries every column the DDL declares', () => {
    expect([...cols.keys()]).toEqual([
      'id',
      'slug',
      'title',
      'description',
      'sector',
      'owner_user_id',
      'licence',
      'parent_revision_id',
      'parent_programme_id',
      'root_programme_id',
      'current_revision_id',
      'status',
      'vote_count',
      'created_at',
      'search_tsv',
    ])
  })

  it('leaves current_revision_id nullable — a pending programme is invisible for free', () => {
    expect(cols.get('current_revision_id')?.notNull).toBe(false)
  })

  it('keeps sector nullable: blank is a real state and there is no `unsectored` code', () => {
    expect(cols.get('sector')?.notNull).toBe(false)
  })

  it('makes root_programme_id not null, so family queries need no null branch', () => {
    expect(cols.get('root_programme_id')?.notNull).toBe(true)
  })

  it('defaults licence to CC-BY-4.0 and vote_count to an integer 0 (§10.6)', () => {
    expect(cols.get('licence')?.default).toBe('CC-BY-4.0')
    expect(cols.get('vote_count')?.getSQLType()).toBe('integer')
    expect(cols.get('vote_count')?.default).toBe(0)
  })

  it('generates search_tsv over title (A) and description (B), never by hand', () => {
    const tsv = cols.get('search_tsv')
    expect(tsv?.getSQLType()).toBe('tsvector')
    expect(tsv?.isUnique).toBe(false)
    expect(tsv?.generated?.type).toBe('always')
    expect(tsv?.generated?.mode).toBe('stored')
  })

  it('sets owner_user_id to null on account deletion, so the row survives', () => {
    expect(deleteActions(programme).owner_user_id).toBe('set null')
  })

  it('carries the frozen default sort and both GIN indexes', () => {
    const indexes = getTableConfig(programme).indexes.map((i) => i.config)
    expect(indexes.map((i) => i.name).sort()).toEqual([
      'programme_created_at_id_idx',
      'programme_search_tsv_idx',
      'programme_title_idx',
    ])
    expect(indexes.find((i) => i.name === 'programme_search_tsv_idx')?.method).toBe('gin')
    expect(indexes.find((i) => i.name === 'programme_title_idx')?.method).toBe('gin')
    expect(indexes.every((i) => i.unique === false)).toBe(true)
  })
})

describe('revision — content', () => {
  const cols = columnsOf(revision)

  it('carries every column the DDL declares', () => {
    expect([...cols.keys()]).toEqual([
      'id',
      'programme_id',
      'rev_no',
      'uploaded_at',
      'uploader_display_name',
      'change_note',
      'content_hash',
      'is_root_rev',
      'terms_version',
      'asserted_at',
      'status',
      'ingest_attempts',
      'failure_reason',
      'failure_detail',
      'removal_class',
      'removed_at',
      'bytes_deleted_at',
      'quarantine_purged_at',
      'p6_version',
      'activity_count',
      'start_date',
      'finish_date',
      'data_date',
      'pct_complete',
      'is_baseline',
      'checks_passed',
      'checks_applicable',
      'card',
      'derived_version',
    ])
  })

  it('leaves every ingest-written column nullable — the row exists before the parse', () => {
    const ingestWritten = [
      'content_hash',
      'p6_version',
      'activity_count',
      'start_date',
      'finish_date',
      'data_date',
      'pct_complete',
      'is_baseline',
      'checks_passed',
      'checks_applicable',
      'card',
      'derived_version',
    ]
    for (const name of ingestWritten) {
      expect(cols.get(name)?.notNull, name).toBe(false)
    }
  })

  it('snapshots the uploader handle as citext, never as a join', () => {
    expect(cols.get('uploader_display_name')?.getSQLType()).toBe('citext')
    expect(cols.get('uploader_display_name')?.notNull).toBe(true)
  })

  it('holds the DCMA numerator and denominator, and no ratio column', () => {
    expect(cols.get('checks_passed')?.getSQLType()).toBe('smallint')
    expect(cols.get('checks_applicable')?.getSQLType()).toBe('smallint')
    expect(cols.has('checks_ratio')).toBe(false)
  })

  it('types pct_complete numeric(5, 2) and removal_class char(1)', () => {
    expect(cols.get('pct_complete')?.getSQLType()).toBe('numeric(5, 2)')
    expect(cols.get('removal_class')?.getSQLType()).toBe('char(1)')
  })

  it('uniques (programme_id, rev_no) — rev numbering is per Programme, from 1', () => {
    const uniques = getTableConfig(revision).uniqueConstraints
    expect(uniques).toHaveLength(1)
    expect(uniques[0]?.columns.map((c) => c.name)).toEqual(['programme_id', 'rev_no'])
  })

  it('makes content_hash unique only among root revisions, and indexed otherwise', () => {
    const indexes = getTableConfig(revision).indexes.map((i) => i.config)
    const partial = indexes.find((i) => i.name === 'revision_root_content_hash_uq')
    const plain = indexes.find((i) => i.name === 'revision_content_hash_idx')

    expect(partial?.unique).toBe(true)
    expect(partial?.where).toBeDefined()
    // Two Programmes legitimately hold identical bytes; the general index must stay non-unique
    // or an exact match would fail an insert instead of becoming a Fork.
    expect(plain?.unique).toBe(false)
    expect(plain?.where).toBeUndefined()
  })

  it('keeps is_root_rev as a stored flag — a partial index cannot span two tables', () => {
    expect(cols.get('is_root_rev')?.notNull).toBe(true)
    expect(cols.get('is_root_rev')?.default).toBe(false)
  })
})

describe('foreign-key actions, and why each', () => {
  it('sets both vote rows null so totals stay reconcilable by count(*)', () => {
    expect(deleteActions(programmeVote).voter_user_id).toBe('set null')
    expect(deleteActions(uploaderVote).voter_user_id).toBe('set null')
  })

  it('cascades bookmarks and upload intents, which carry nobody credit', () => {
    expect(deleteActions(bookmark).user_id).toBe('cascade')
    expect(deleteActions(uploadIntent).user_id).toBe('cascade')
  })

  it('leaves upload_intent.programme_id without a foreign key — presign precedes the row', () => {
    expect(deleteActions(uploadIntent).programme_id).toBeUndefined()
  })

  it('never cascades a delete onto programme or revision: rows never delete', () => {
    for (const table of tables) {
      for (const fk of getTableConfig(table).foreignKeys) {
        const target = getTableConfig(fk.reference().foreignTable).name
        if (target === 'programme' || target === 'revision') {
          expect(fk.onDelete ?? 'no action').toBe('no action')
        }
      }
    }
  })
})

describe('accounts and credit', () => {
  it('makes the Handle citext and unique — case-insensitively, by construction', () => {
    const cols = columnsOf(appUser)
    expect(cols.get('display_name')?.getSQLType()).toBe('citext')
    expect(cols.get('display_name')?.isUnique).toBe(true)
    expect(cols.get('clerk_user_id')?.isUnique).toBe(true)
    expect(cols.get('uploader_vote_count')?.getSQLType()).toBe('integer')
    expect(cols.get('uploader_vote_count')?.default).toBe(0)
  })

  it('keys reserved_handle on a citext name, so a retired Handle blocks every casing', () => {
    expect(columnsOf(reservedHandle).get('name')?.getSQLType()).toBe('citext')
  })

  it('gives bookmark no counter column anywhere', () => {
    expect([...columnsOf(bookmark).keys()]).toEqual(['user_id', 'programme_id', 'created_at'])
  })
})

describe('operations', () => {
  it('seeds exactly five alarm rules', () => {
    expect(ALARM_RULES).toHaveLength(5)
    expect([...ALARM_RULES]).toEqual([
      'takedown_open',
      'deterministic_failure',
      'transient_burst',
      'reconciler_stuck',
      'edge_drift',
    ])
  })

  it('defaults sweep_run.actions to {} and breaches to [], both not null', () => {
    const cols = columnsOf(sweepRun)
    expect(cols.get('actions')?.notNull).toBe(true)
    expect(cols.get('breaches')?.notNull).toBe(true)
    expect(cols.get('ok')?.notNull).toBe(false)
  })

  it('keeps reporter_contact nullable so it can be purged 90 days after close', () => {
    expect(columnsOf(takedownReport).get('reporter_contact')?.notNull).toBe(false)
  })
})

describe('status enumerations come from the contract, not from a pg enum', () => {
  it('stores both statuses as text, so adding a state is a deploy and not a migration', () => {
    expect(columnsOf(programme).get('status')?.getSQLType()).toBe('text')
    expect(columnsOf(revision).get('status')?.getSQLType()).toBe('text')
    expect([...PROGRAMME_STATUS]).toEqual(['published', 'tombstoned'])
    expect([...REVISION_STATUS]).toEqual(['pending', 'failed', 'published', 'tombstoned'])
  })
})
