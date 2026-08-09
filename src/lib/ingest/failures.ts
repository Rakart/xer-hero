/**
 * Failure classes, and the one rule that governs what may be written about a failure.
 *
 * `failure_reason` is **a class, not a cause** (§5.7) — it is rendered to the owner at
 * `/p/{slug}` and at `/me`, and it exists because the app cannot send mail, so if the tab was
 * closed an in-app row is the only channel left.
 *
 * `failure_detail` is operator-only and **must never quote file bytes**. It carries the
 * exception name, its message and the parse *position* — table, row index, field index. The
 * natural instinct of a tokenizer error is to echo the offending line, and that line can carry
 * a resource name, which is a person. This is the one place in the design where a careless
 * implementation would rebuild, inside an error string, exactly the personal-data surface the
 * design refused to build on purpose.
 */

export type FailureClass =
  | 'unreadable'
  | 'not_xer'
  | 'tokenizer'
  | 'no_activities'
  | 'multi_project'
  | 'over_cap'
  | 'duplicate'
  | 'removed'
  | 'internal'

/** The uploader's sentence. Plain, non-technical, and never a stack trace. */
export const FAILURE_REASONS: Record<FailureClass, string> = {
  unreadable: 'The file could not be read to the end — it looks truncated or corrupt.',
  not_xer: 'That file is not a Primavera P6 .xer export.',
  tokenizer: 'The file is a .xer but its structure could not be read.',
  no_activities: 'The export contains no activities.',
  multi_project: 'The export contains more than one project. Export one project at a time.',
  over_cap: 'The export is above the size limits — 20,000 activities and 60 MB.',
  duplicate: 'An identical file was already published. Fork that programme instead.',
  removed: 'This file has been removed from xer-hero.',
  internal: 'Something went wrong on our side while reading the file.',
}

/**
 * Deterministic faults go straight to `failed`; transient ones leave the row `pending` for the
 * sweep to retry (§5.9). Deterministic failures should be **near-extinct**, because the client
 * scan catches all of them before a byte moves — so one reaching ingest means a bypassed client
 * or a bug, which is worth seeing rather than merely counting.
 */
export const DETERMINISTIC: ReadonlySet<FailureClass> = new Set<FailureClass>([
  'unreadable',
  'not_xer',
  'tokenizer',
  'no_activities',
  'multi_project',
  'over_cap',
  'duplicate',
  'removed',
])

export class IngestFailure extends Error {
  readonly failureClass: FailureClass
  /** Operator-only. Position, never bytes. */
  readonly detail: string
  readonly deterministic: boolean

  constructor(failureClass: FailureClass, detail = '') {
    super(FAILURE_REASONS[failureClass])
    this.name = 'IngestFailure'
    this.failureClass = failureClass
    this.detail = detail
    this.deterministic = DETERMINISTIC.has(failureClass)
  }

  /**
   * The uploader's sentence. It is `message` — `super()` was called with it — and exists under
   * this name because `failure_reason` is what the column is called and what `/me` renders.
   */
  get reason(): string {
    return this.message
  }
}

/**
 * Renders an unexpected exception for `failure_detail` without ever reaching into its data.
 * Only the constructor name and the message survive, and the message is truncated — an
 * exception thrown deep in a parse can carry a row in its text.
 */
export function safeDetail(error: unknown, position?: string): string {
  const name = error instanceof Error ? error.name : typeof error
  const message = error instanceof Error ? error.message.slice(0, 300) : ''
  return [name, message, position].filter(Boolean).join(' | ')
}
