/**
 * The generated migration SQL, checked against §2.10 and against the versioned lists it
 * seeds from.
 *
 * The seeded sector rows are the reason this file exists. §1.6 says a code is added by a
 * migration generated from the versioned list in the repo — a PR and a deploy, never a
 * hand-written `INSERT` on production. Nothing enforces that on its own, so this test is the
 * enforcement: edit `SECTORS` without writing the migration, or write the migration without
 * editing `SECTORS`, and it fails.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SECTORS } from '@/lib/contracts/domain'
import { ALARM_RULES } from './schema'

const drizzleDir = fileURLToPath(new URL('../../../drizzle/', import.meta.url))
const read = (file: string): string => readFileSync(`${drizzleDir}${file}`, 'utf8')

const journal = JSON.parse(read('meta/_journal.json')) as {
  entries: { idx: number; tag: string }[]
}
const files = readdirSync(drizzleDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const extensions = read('0000_extensions.sql')
const ddl = read('0001_schema.sql')
const seed = read('0002_seed_sector_and_alarm_state.sql')

describe('the migration set', () => {
  it('has one journal entry per SQL file, in order', () => {
    expect(journal.entries.map((e) => `${e.tag}.sql`)).toEqual(files)
    expect(journal.entries.map((e) => e.idx)).toEqual([0, 1, 2])
  })

  it('creates both contrib extensions before anything that needs them', () => {
    expect(journal.entries[0]?.tag).toBe('0000_extensions')
    expect(extensions).toContain('create extension if not exists citext')
    expect(extensions).toContain('create extension if not exists pg_trgm')
    // citext is a column type in 0001; pg_trgm supplies gin_trgm_ops there too.
    expect(ddl).toContain('"citext"')
    expect(ddl).toContain('gin_trgm_ops')
  })

  it('is re-runnable, because the HTTP driver cannot roll a failed migration back', () => {
    expect(extensions).toContain('if not exists')
    expect(seed.match(/^on conflict \(\w+\) do nothing;$/gm)).toHaveLength(2)
  })
})

describe('the DDL against §2.10', () => {
  it('generates search_tsv as a stored tsvector weighted A over title, B over description', () => {
    expect(ddl).toContain(
      `"search_tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')) STORED`,
    )
  })

  it('uniques content_hash only among root revisions, and indexes it plainly otherwise', () => {
    expect(ddl).toContain(
      'CREATE UNIQUE INDEX "revision_root_content_hash_uq" ON "revision" USING btree ("content_hash") WHERE "revision"."is_root_rev"',
    )
    expect(ddl).toContain(
      'CREATE INDEX "revision_content_hash_idx" ON "revision" USING btree ("content_hash")',
    )
  })

  it('indexes the frozen default sort as DESC NULLS FIRST, which is what `desc` means', () => {
    expect(ddl).toContain(
      'CREATE INDEX "programme_created_at_id_idx" ON "programme" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST)',
    )
  })

  it('builds both GIN indexes on programme', () => {
    expect(ddl).toContain(
      'CREATE INDEX "programme_search_tsv_idx" ON "programme" USING gin ("search_tsv")',
    )
    expect(ddl).toContain(
      'CREATE INDEX "programme_title_idx" ON "programme" USING gin ("title" gin_trgm_ops)',
    )
  })

  it('adds no index on any revision facet column — none is measured slow yet', () => {
    for (const column of ['p6_version', 'activity_count', 'pct_complete', 'card']) {
      expect(ddl, column).not.toContain(`ON "revision" USING btree ("${column}")`)
    }
  })

  it('carries the four foreign-key actions that are not the default', () => {
    const setNull = ddl.match(/ON DELETE set null/g) ?? []
    const cascade = ddl.match(/ON DELETE cascade/g) ?? []
    expect(setNull).toHaveLength(3) // owner_user_id and both voter_user_id columns
    expect(cascade).toHaveLength(2) // bookmark.user_id and upload_intent.user_id
  })

  it('leaves upload_intent.programme_id without a foreign key', () => {
    expect(ddl).not.toContain('"upload_intent" ADD CONSTRAINT "upload_intent_programme_id')
  })
})

describe('the seeded sector rows', () => {
  const rows = [...seed.matchAll(/\('([a-z-]+)',\s*'([^']*)',\s*(\d+)\)/g)].map((m) => ({
    code: m[1],
    label: m[2],
    sort_order: Number(m[3]),
  }))

  it('matches the versioned list in contracts/domain.ts exactly, and in its order', () => {
    expect(rows).toEqual(SECTORS.map((s) => ({ ...s })))
  })

  it('seeds eight codes and no ninth — `unsectored` is a null column, not a row', () => {
    expect(rows).toHaveLength(8)
    expect(rows.map((r) => r.code)).not.toContain('unsectored')
  })

  it('keeps sort_order in the taxonomy order, not alphabetical', () => {
    expect(rows.map((r) => r.sort_order)).toEqual([10, 20, 30, 40, 50, 60, 70, 80])
    expect(rows.map((r) => r.code)).not.toEqual([...rows.map((r) => r.code)].sort())
  })
})

describe('the seeded alarm rules', () => {
  const rules = [...seed.matchAll(/^ {2}\('([a-z_]+)'\),?$/gm)].map((m) => m[1])

  it('seeds exactly the five rules the schema declares', () => {
    expect(rules).toEqual([...ALARM_RULES])
    expect(rules).toHaveLength(5)
  })
})
