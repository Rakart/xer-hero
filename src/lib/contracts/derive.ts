/**
 * The derive pipeline's seam: one call in, three artefacts out.
 *
 * Ingest, seeding and the lazy recompute path (§3.13) all go through this one signature, so
 * there is exactly one producer of `derived.json` in the estate. §4.9 rejects committed
 * pre-computed JSON for that reason — a second producer against a contract that has already
 * moved twice is how the two drift.
 */

import type { ActivitiesPayload } from './activities'
import type { CardPayload } from './card'
import type { Derived } from './derived'
import type { XerFile } from './xer'

export interface DeriveInput {
  file: XerFile
  programmeId: string
  revisionId: string
  /** Stamped into `derived.json`; the staleness marker is the version integer in the key. */
  parserVersion: string
  /** Injected rather than read from the clock, so a derive is reproducible in a test. */
  computedAt: string
}

export interface DeriveOutput {
  derived: Derived
  activities: ActivitiesPayload
  /** The typed Postgres columns ingest writes alongside the blobs (§5.5, step 6). */
  row: RevisionFacets
}

/**
 * The facet columns. Typed Postgres columns are for values that are **sorted, ranged or
 * faceted**; everything the row merely prints lives in `card` (§3.14).
 */
export interface RevisionFacets {
  p6_version: string | null
  activity_count: number | null
  start_date: string | null
  finish_date: string | null
  data_date: string | null
  pct_complete: number | null
  is_baseline: boolean | null
  checks_passed: number | null
  checks_applicable: number | null
  card: CardPayload
  derived_version: number
}

export type DeriveFn = (input: DeriveInput) => DeriveOutput
