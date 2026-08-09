/**
 * The programme page's public surface. The two routes under `src/app/p/` import from here
 * and from nowhere inside it, so the page's shape is one import list rather than a habit.
 *
 * Everything except `load.ts` is presentational: nothing here reads the session, and the
 * only thing that reads Postgres or a blob is the loader the routes await.
 */

export type { ToggleAction } from './Actions'
export {
  OG_DEFAULTS,
  ogStrings,
  programmeHead,
  programmePath,
  revisionHead,
  revisionPath,
} from './crawl'
export {
  buildProgrammeView,
  buildTombstoneView,
  derivedVersionOf,
  loadDerived,
  loadProgrammeRow,
  loadRevisionRow,
} from './load'
export { ProgrammeDocument } from './ProgrammeDocument'
export { Tombstone } from './Tombstone'
export type {
  AncestorView,
  ProgrammeView,
  RevisionEntry,
  RevisionView,
  TombstoneView,
} from './types'
