/**
 * The persisted schema (§2.10), rendered in Drizzle.
 *
 * One split underlies all of it: **Programme is identity, Revision is content.** Derived
 * statistics live on Revision only; `programme.current_revision_id` is what makes the grid
 * one query — a PK join satisfies the one-query rule, because the constraint was one query,
 * not zero joins.
 *
 * Column names are spelled out rather than inferred from a casing rule, so this file can be
 * read against §2.10's SQL line by line, which is the only review that matters here.
 */

import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  char,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { CardPayload } from '@/lib/contracts/card'
import type {
  ProgrammeStatus,
  RemovalClass,
  RevisionStatus,
  SectorCode,
} from '@/lib/contracts/domain'

// --- types Postgres has and Drizzle does not --------------------------------

/**
 * `citext` — case-insensitive text, a contrib extension on stock Postgres and therefore not
 * a Neon dependency (§4.9). Handles are unique case-insensitively (§2.11), and doing that
 * with `citext` rather than a `lower()` expression index means every comparison in every
 * query is case-insensitive by construction instead of by remembering.
 */
const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
})

/** `tsvector` — only ever written by the generated column below, never by hand. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
})

// --- payload shapes ---------------------------------------------------------

/**
 * `revision.card` — the display-only payload for one shelf row (§6.2), ~200 bytes, fed from
 * `derived.json` at ingest.
 *
 * It is an **alias, not a second declaration**. The column and the derive step that fills it
 * have to agree field for field, and two structurally identical interfaces in two files agree
 * only until one of them is edited. `CardPayload` is the one definition; this name exists
 * because a schema reads better naming its own column's shape.
 */
export type ShelfCard = CardPayload

/** `sweep_run.actions` — what one sweep did (§5.10). */
export interface SweepActions {
  retried?: number
  reaped?: number
  tombstones_completed?: number
  quarantines_destroyed?: number
}

/** `sweep_run.breaches` — rule key plus count, per breaching rule (§5.10). */
export interface SweepBreach {
  rule: AlarmRule
  count: number
}

/**
 * The five alarm rules (§2.10, §5.10). `alarm_state` holds **exactly five rows, seeded by
 * migration**, which means every future rule is a migration too — kept deliberately, because
 * the seeded set is an inventory `/ops` renders rather than a log, and upsert-on-first-run
 * would hide a rule from the dashboard until it had successfully run once.
 */
export const ALARM_RULES = [
  'takedown_open',
  'deterministic_failure',
  'transient_burst',
  'reconciler_stuck',
  'edge_drift',
] as const
export type AlarmRule = (typeof ALARM_RULES)[number]

/** `takedown_report.status` (§2.10). */
export const TAKEDOWN_STATUS = ['open', 'awaiting_owner', 'actioned', 'rejected'] as const
export type TakedownStatus = (typeof TAKEDOWN_STATUS)[number]

// --- identity ---------------------------------------------------------------

export const programme = pgTable(
  'programme',
  {
    id: uuid('id').primaryKey(),
    /**
     * Immutable, public handle (§2.11). Titles are editable, so a frozen slug means no
     * redirect table, no link rot and no alias history; a slug drifting from a renamed title
     * is cosmetic. The uuid stays the primary key and never appears in a link.
     */
    slug: text('slug').notNull().unique('programme_slug_key'),
    title: text('title').notNull(),
    description: text('description'),
    /** Nullable; declared by the uploader, never inferred (§1.6). Blank is a real state. */
    sector: text('sector')
      .$type<SectorCode>()
      .references((): AnyPgColumn => sectorTable.code),
    owner_user_id: uuid('owner_user_id').references((): AnyPgColumn => appUser.id, {
      onDelete: 'set null',
    }),
    licence: text('licence').notNull().default('CC-BY-4.0'),

    /**
     * The authoritative fork edge points at a **Revision** (§2.11), with the parent Programme
     * denormalised beside it. The two can never disagree, because Revisions are immutable and
     * each belongs to exactly one Programme — and it is what makes a revision-granular
     * Class B cascade correct: if revision 17 is tainted and someone forked revision 3, a
     * programme-only pointer would tombstone a Fork that never held the tainted content.
     */
    parent_revision_id: uuid('parent_revision_id').references((): AnyPgColumn => revision.id),
    parent_programme_id: uuid('parent_programme_id').references((): AnyPgColumn => programme.id),
    /**
     * Self-references on roots, so family queries need no null branch. Denormalised from the
     * parent chain anyway: one indexed equality returns the whole fork family, which a
     * recursive CTE on a grid could not do inside the one-query rule.
     */
    root_programme_id: uuid('root_programme_id')
      .notNull()
      .references((): AnyPgColumn => programme.id),

    /**
     * Newest non-tombstoned Revision; **null until ingest publishes**. The grid is
     * `programme join revision on current_revision_id`, and an inner join drops nulls — so a
     * pending Programme is invisible to the shelf for free, with no status predicate. Do not
     * "fix" this into a `status <> 'pending'` filter: the null is the mechanism.
     */
    current_revision_id: uuid('current_revision_id').references((): AnyPgColumn => revision.id),
    /**
     * `published | tombstoned`. Text rather than a Postgres enum: adding a value to an enum
     * is a migration and a type rewrite, and these are app-level states the app already
     * validates. The union type is the check that matters at the call sites.
     */
    status: text('status').$type<ProgrammeStatus>().notNull(),
    /** Denormalised, maintained on write. `integer`, not `bigint` (§10.6). */
    vote_count: integer('vote_count').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull(),

    /**
     * Full-text search over **title and description only** (§6.3), `setweight('A')` on title
     * and `'B'` on description, queried with `websearch_to_tsquery`. §2.10 adds this by
     * `alter table`; a generated column declared in `create table` is the same object, and
     * declaring it here is what keeps `drizzle-kit generate` aware of it.
     *
     * The expression names its columns bare, because a generation expression may not
     * table-qualify, and pins the `english` regconfig explicitly, because the two-argument
     * `to_tsvector` is only immutable — and therefore only legal in a generated column —
     * when the configuration is given rather than read from `default_text_search_config`.
     */
    search_tsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')`,
    ),
  },
  (t) => [
    // Names are Postgres's own defaults for an unnamed `create index`, so an introspection
    // diff against §2.10's DDL applied by hand comes back empty.
    index('programme_search_tsv_idx').using('gin', t.search_tsv),
    /** Zero-result fallback: one stemmed miss ("depot" vs "depots") gets a did-you-mean. */
    index('programme_title_idx').using('gin', t.title.op('gin_trgm_ops')),
    /**
     * The frozen default sort (§6.3), `order by created_at desc, id desc`. Never becomes
     * vote-weighted.
     *
     * `nullsFirst()` is not cosmetic and must not be simplified away: Postgres reads a bare
     * `desc` in an `order by` as `desc nulls first`, and an index declared `desc nulls last`
     * — which is Drizzle's default — sorts in an order the planner cannot match, so it
     * would silently stop being usable for the one sort the whole shelf runs.
     */
    index('programme_created_at_id_idx').on(
      t.created_at.desc().nullsFirst(),
      t.id.desc().nullsFirst(),
    ),
  ],
)

// --- content ----------------------------------------------------------------

export const revision = pgTable(
  'revision',
  {
    id: uuid('id').primaryKey(),
    programme_id: uuid('programme_id')
      .notNull()
      .references((): AnyPgColumn => programme.id),
    /** From 1, per Programme. A planner says "rev 12", not a uuid (§2.11). */
    rev_no: integer('rev_no').notNull(),
    uploaded_at: timestamp('uploaded_at', { withTimezone: true }).notNull(),

    /**
     * A snapshot, never a join. It is retained through account deletion — the pseudonym is
     * what makes that work (§2.11) — so resolving it live would be wrong even where possible.
     */
    uploader_display_name: citext('uploader_display_name').notNull(),
    /** Required on a fork's rev 1. */
    change_note: text('change_note'),
    /**
     * SHA-256 over the decompressed bytes, computed by **ingest**; null until then. Nothing
     * the client computes is persisted (§2.11) — the browser's `crypto.subtle.digest` drives
     * a lookup and nothing else, so enforcement lands on the write that carries trusted bytes.
     *
     * Deliberately **non-unique in general**: two Programmes legitimately hold identical
     * bytes, and an exact match against a live root makes the upload a Fork rather than a
     * second root. It is unique **only** among root revisions, via the partial index below.
     */
    content_hash: text('content_hash'),
    /**
     * Programme is a root and `rev_no = 1`. It exists as a stored flag for exactly one
     * reason: a partial index cannot span two tables, so the root-ness of a Revision has to
     * be readable from the Revision row for `revision_root_content_hash_uq` to be expressible.
     */
    is_root_rev: boolean('is_root_rev').notNull().default(false),
    terms_version: text('terms_version').notNull(),
    asserted_at: timestamp('asserted_at', { withTimezone: true }).notNull(),

    /** `pending | failed | published | tombstoned`. */
    status: text('status').$type<RevisionStatus>().notNull(),
    ingest_attempts: smallint('ingest_attempts').notNull().default(0),
    /** Shown to the uploader, verbatim, inline on `/me` (§6.12). */
    failure_reason: text('failure_reason'),
    /** Operator-only; position, never file bytes. `/ops` is its sole reader (§5.10). */
    failure_detail: text('failure_detail'),
    removal_class: char('removal_class', { length: 1 }).$type<RemovalClass>(),
    removed_at: timestamp('removed_at', { withTimezone: true }),
    /**
     * *Public bytes destroyed and CDN purge confirmed.* It exists so the reconciler is a pure
     * SQL predicate (`status = 'tombstoned' and bytes_deleted_at is null`) rather than an R2
     * listing (§2.11). Quarantine expiry needs no column of its own: it is
     * `removed_at + interval '30 days'` where `removal_class = 'B'`.
     */
    bytes_deleted_at: timestamp('bytes_deleted_at', { withTimezone: true }),
    quarantine_purged_at: timestamp('quarantine_purged_at', { withTimezone: true }),

    // Written by ingest, therefore all nullable: the row exists before the parse.
    /** Facet. */
    p6_version: text('p6_version'),
    /** Sort key and the size-band facet. */
    activity_count: integer('activity_count'),
    /**
     * Naive local wall-clock, as written — the `.xer` records no timezone anywhere (§3.4), so
     * these stay `date` in string mode and are never round-tripped through a JS `Date`.
     */
    start_date: date('start_date'),
    finish_date: date('finish_date'),
    data_date: date('data_date'),
    /**
     * `numeric(5,2)` read as a number: a two-decimal percentage is exact in a double, and
     * string mode exists for values that are not, which this is not.
     */
    pct_complete: numeric('pct_complete', { precision: 5, scale: 2, mode: 'number' }),
    is_baseline: boolean('is_baseline'),
    /** DCMA. Sorted on as a ratio, never a raw count — applicable varies from 10 to 14. */
    checks_passed: smallint('checks_passed'),
    checks_applicable: smallint('checks_applicable'),
    card: jsonb('card').$type<ShelfCard>(),
    /** Staleness marker; the contract is at v4 and `DERIVED_VERSION` is its one source. */
    derived_version: smallint('derived_version'),
  },
  (t) => [
    unique('revision_programme_id_rev_no_key').on(t.programme_id, t.rev_no),
    /** Dedup: one root per byte-identical file. */
    uniqueIndex('revision_root_content_hash_uq').on(t.content_hash).where(sql`${t.is_root_rev}`),
    /** Lookups — the tombstone-hash check and the fork-instead-of-root check. Not unique. */
    index('revision_content_hash_idx').on(t.content_hash),
  ],
)

// --- accounts ---------------------------------------------------------------

export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey(),
  /** The only link to the Google identity. */
  clerk_user_id: text('clerk_user_id').notNull().unique('app_user_clerk_user_id_key'),
  /** The Handle. Unique case-insensitively, which is what `citext` buys (§2.11). */
  display_name: citext('display_name').notNull().unique('app_user_display_name_key'),
  /** Denormalised, maintained on write. `integer`, not `bigint` (§10.6). */
  uploader_vote_count: integer('uploader_vote_count').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
})

/**
 * A Handle is written here on rename and on deletion and **never reassigned**, even one
 * generated but never published: a wasted row is cheaper than a conditional (§2.11).
 */
export const reservedHandle = pgTable('reserved_handle', {
  name: citext('name').primaryKey(),
  released_at: timestamp('released_at', { withTimezone: true }).notNull(),
})

/**
 * Lean and grown by insert (§1.6): adding a code is a seeded row applied by migration from
 * the versioned list in `contracts/domain.ts` — a PR and a deploy, never a hand-written
 * `INSERT` on production. Exported as `sectorTable` because `sector` is also a column name.
 */
export const sectorTable = pgTable('sector', {
  code: text('code').$type<SectorCode>().primaryKey(),
  label: text('label').notNull(),
  /** Transport → vertical → utilities → process, **not** alphabetical. */
  sort_order: integer('sort_order').notNull(),
})

// --- credit -----------------------------------------------------------------

/**
 * `voter_user_id` is `on delete set null` so the row survives account deletion: the vote
 * rows keep the denormalised totals reconcilable by `count(*)` while the personal reference
 * is erased (§2.10). Self-votes are permitted — a constant offset reorders nothing (§6.3).
 */
export const programmeVote = pgTable(
  'programme_vote',
  {
    voter_user_id: uuid('voter_user_id').references((): AnyPgColumn => appUser.id, {
      onDelete: 'set null',
    }),
    programme_id: uuid('programme_id')
      .notNull()
      .references((): AnyPgColumn => programme.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    unique('programme_vote_voter_user_id_programme_id_key').on(t.voter_user_id, t.programme_id),
  ],
)

export const uploaderVote = pgTable(
  'uploader_vote',
  {
    voter_user_id: uuid('voter_user_id').references((): AnyPgColumn => appUser.id, {
      onDelete: 'set null',
    }),
    subject_user_id: uuid('subject_user_id')
      .notNull()
      .references((): AnyPgColumn => appUser.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    unique('uploader_vote_voter_user_id_subject_user_id_key').on(
      t.voter_user_id,
      t.subject_user_id,
    ),
  ],
)

/**
 * Private; **no counter anywhere**. `on delete cascade` rather than `set null` because a
 * bookmark carries nobody's credit — there is nothing to keep reconcilable (§2.10).
 */
export const bookmark = pgTable(
  'bookmark',
  {
    user_id: uuid('user_id')
      .notNull()
      .references((): AnyPgColumn => appUser.id, { onDelete: 'cascade' }),
    programme_id: uuid('programme_id')
      .notNull()
      .references((): AnyPgColumn => programme.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [unique('bookmark_user_id_programme_id_key').on(t.user_id, t.programme_id)],
)

// --- upload -----------------------------------------------------------------

/**
 * Written at presign; makes abandoned bytes findable. `programme_id` carries **no foreign
 * key on purpose** — the intent is recorded before the Programme row exists, which is the
 * whole point of it. `user_id` is `on delete cascade`: an intent without one raises a
 * foreign-key violation at account deletion (§2.10).
 */
export const uploadIntent = pgTable('upload_intent', {
  revision_id: uuid('revision_id').primaryKey(),
  programme_id: uuid('programme_id').notNull(),
  user_id: uuid('user_id')
    .notNull()
    .references((): AnyPgColumn => appUser.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
})

// --- takedown ---------------------------------------------------------------

export const takedownReport = pgTable('takedown_report', {
  /** The case reference, quoted to the reporter. */
  id: uuid('id').primaryKey(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull(),
  /** Purged 90 days after close; `/ops` never renders it (§5.10). */
  reporter_contact: text('reporter_contact'),
  contact_purged_at: timestamp('contact_purged_at', { withTimezone: true }),
  subject_ref: text('subject_ref'),
  /** PI cases; feeds the corpus scan. */
  name_as_it_appears: text('name_as_it_appears'),
  reported_reason: text('reported_reason').notNull(),
  /** Operator-assigned, not reporter-declared. */
  class: char('class', { length: 1 }).$type<RemovalClass>(),
  status: text('status').$type<TakedownStatus>().notNull(),
  resolution_note: text('resolution_note'),
  plan_ref: text('plan_ref'),
  actioned_at: timestamp('actioned_at', { withTimezone: true }),
})

// --- operations -------------------------------------------------------------

/**
 * Append-only history and heartbeat. **No reaper**: 96 rows a day is ~35,000 a year against
 * a ~150 MB database, and the history is worth more than the bytes (§5.10).
 */
export const sweepRun = pgTable('sweep_run', {
  id: uuid('id').primaryKey(),
  started_at: timestamp('started_at', { withTimezone: true }).notNull(),
  finished_at: timestamp('finished_at', { withTimezone: true }),
  /** The verdict the scheduled workflow asserts on. */
  ok: boolean('ok'),
  actions: jsonb('actions').$type<SweepActions>().notNull().default(sql`'{}'::jsonb`),
  breaches: jsonb('breaches').$type<SweepBreach[]>().notNull().default(sql`'[]'::jsonb`),
  error: text('error'),
})

/**
 * Exactly five rows, seeded by migration. Separate from `sweep_run` because that table is
 * append-only history and suppression is mutable current state; conflating them means
 * reading the last row to write the next one (§5.10).
 */
export const alarmState = pgTable('alarm_state', {
  rule: text('rule').$type<AlarmRule>().primaryKey(),
  breaching: boolean('breaching').notNull().default(false),
  breaching_since: timestamp('breaching_since', { withTimezone: true }),
  last_alarmed_at: timestamp('last_alarmed_at', { withTimezone: true }),
})

// --- row types --------------------------------------------------------------

export type Programme = typeof programme.$inferSelect
export type NewProgramme = typeof programme.$inferInsert
export type Revision = typeof revision.$inferSelect
export type NewRevision = typeof revision.$inferInsert
export type AppUser = typeof appUser.$inferSelect
export type NewAppUser = typeof appUser.$inferInsert
export type Sector = typeof sectorTable.$inferSelect
export type TakedownReport = typeof takedownReport.$inferSelect
export type SweepRun = typeof sweepRun.$inferSelect
export type AlarmState = typeof alarmState.$inferSelect
