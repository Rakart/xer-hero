/**
 * `lib/xer` — the `.xer` reader, and the only place the file format is known.
 *
 * The identical module runs authoritatively in a Vercel Function and advisorily in the browser
 * (§5.2), so it is isomorphic TypeScript with no Node built-ins and no runtime dependencies:
 * the CP1252 table is written out, the digest comes from WebCrypto, and nothing here touches a
 * filesystem. Downstream reads cells through `cell`/`reader` and never by position (§2.7).
 */

export {
  cell,
  type IssueSeverity,
  type ParseIssue,
  reader,
  toRecord,
  type XerCell,
  type XerFile,
  type XerHeader,
  XerParseError,
  type XerTable,
} from '@/lib/contracts/xer'
export { type DecodeReport, decodeCp1252, decodeCp1252WithReport } from './decode'
export { parseXer, TOKENIZER_FAILURE_MESSAGE, tokenize, type XerVisitor } from './parse'
export {
  NO_READ_ABOVE_BYTES,
  PERSONAL_DATA_LIST_CAP,
  type ScanGuard,
  type ScanOptions,
  type ScanPersonalData,
  type ScanResource,
  type ScanResult,
  type ScanVerdict,
  type ScanWbsShape,
  scanVerdict,
  scanXer,
  scanXerSync,
  sizeOnlyVerdict,
} from './scan'
