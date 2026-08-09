/**
 * The four kinds of missing, kept distinct on the page (§3.10).
 *
 * A bare `null` would conflate four genuinely different situations, all of which occur in
 * the real fixtures — so the contract tags them, and this page's whole reason for reading
 * the tag is that a planner must be able to tell them apart:
 *
 * | situation | contract | what the page must say |
 * |---|---|---|
 * | degenerate but real | bare value (`wbs_depth: 1`) | the value, with no apology |
 * | inapplicable | `skip` + reason | *not applicable*, with the reason |
 * | absent from source | `unavailable` + reason | *not in the file*, with the reason |
 * | computation failed | `error` + reason, plus `issues[]` | *could not be computed*, and **only this one reaches the partially-analysed banner** |
 *
 * Rendering `skip` as `fail`, or either as a blank, is the specific failure this module
 * exists to make impossible.
 */

import type { Derived, DerivedIssue, StatState } from '@/lib/contracts/derived'

export type MissingState = Exclude<StatState, 'ok'>

/** A tagged stat, as every failable stat in `derived.json` is shaped. */
export type Tagged<T> = (T & { state?: 'ok' }) | { state: MissingState; reason: string }

export interface Missing {
  state: MissingState
  reason: string
}

/** Narrows a tagged stat to its value, or to the reason it has none. */
export function readStat<T extends object>(stat: Tagged<T>): { ok: T } | { missing: Missing } {
  const state = (stat as { state?: StatState }).state
  if (state && state !== 'ok') {
    return { missing: { state, reason: (stat as { reason?: string }).reason ?? '' } }
  }
  return { ok: stat as T }
}

/**
 * The word each missing state renders as. They are deliberately different phrases rather
 * than three shades of "no data": *not applicable* is a property of the programme, *not in
 * the file* is a property of the export, and *could not be computed* is ours.
 *
 * None of them characterises the programme — §7.4 rules out any word that would.
 */
export const MISSING_WORD: Record<MissingState, string> = {
  skip: 'not applicable',
  unavailable: 'not in the file',
  error: 'could not be computed',
}

/**
 * The stats this page reads that carry a state, by their dotted path — the same paths
 * `issues[]` uses, so a banner entry and the block it came from can be matched up.
 */
export const TAGGED_STAT_PATHS = ['time.duration_working_days', 'logic.longest_path'] as const

export interface BannerEntry {
  stat: string
  reason: string
}

/**
 * What the *partially analysed* banner prints (§6.7 item 7, §3.10).
 *
 * **Only `error`-state stats reach it.** A `skip` or an `unavailable` is a complete answer —
 * a tender programme with no progress genuinely has no out-of-sequence work — and banging a
 * warning banner over one would teach visitors that the badge means nothing.
 *
 * `issues[]` entries at `error` severity are included even when they name a stat this page
 * does not model, so the banner stays honest as the contract grows; entries at `info` and
 * `warn` are not, and get the quieter home in the provenance footer.
 */
export function bannerEntries(derived: Derived): BannerEntry[] {
  const entries: BannerEntry[] = []
  const seen = new Set<string>()

  const push = (stat: string, reason: string) => {
    if (seen.has(stat)) return
    seen.add(stat)
    entries.push({ stat, reason })
  }

  const working = readStat(derived.time.duration_working_days)
  if ('missing' in working && working.missing.state === 'error') {
    push('time.duration_working_days', working.missing.reason)
  }
  const longest = readStat(derived.logic.longest_path)
  if ('missing' in longest && longest.missing.state === 'error') {
    push('logic.longest_path', longest.missing.reason)
  }

  for (const issue of derived.issues) {
    if (issue.severity === 'error') push(issue.stat, issue.reason)
  }

  return entries
}

/** Everything `issues[]` recorded that is *not* banner-worthy, in the order ingest wrote it. */
export function noteEntries(derived: Derived): DerivedIssue[] {
  return derived.issues.filter((issue) => issue.severity !== 'error')
}

/** The `⚠ partially analysed` badge and the banner are one predicate, never two. */
export function isPartiallyAnalysed(derived: Derived): boolean {
  return bannerEntries(derived).length > 0
}
