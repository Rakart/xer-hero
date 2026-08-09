/**
 * CP1252 → string, lossy by construction (§2.3).
 *
 * A `.xer` declares no encoding and `file -bi` calls it `charset=binary`, so the encoding is
 * a decision rather than a reading: Windows-1252, decoded leniently. **An upload is never
 * rejected on encoding** (§5.3) — a file that trips a decoder is a file we mis-decoded, and
 * one real fixture carries 31,485 bytes that a strict decoder throws on.
 *
 * The 128-entry table is written out rather than delegated to `TextDecoder('windows-1252')`
 * because the identical module runs in a Vercel Function and in a browser and the label is
 * optional in the platform specs of neither. The values below are the WHATWG windows-1252
 * index, so where a `TextDecoder` does exist it agrees byte for byte — §5.2 checked that by
 * use across WebKit, Gecko and Blink.
 */

/**
 * `0x80`–`0x9F`, the part of CP1252 that is *not* Latin-1 and is where a decoder that guesses
 * mangles real data: `enc-cp1252-currency` puts an em dash and curly quotes in activity names.
 *
 * Five slots — `0x81`, `0x8D`, `0x8F`, `0x90`, `0x9D` — have no CP1252 character at all. They
 * map here to their C1 control code points, which is both what WHATWG specifies and what keeps
 * the byte recoverable: `0x81` occurs 28,774 times in one real fixture.
 */
const HIGH: readonly number[] = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x008d, 0x017d, 0x008f, 0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
]

const TABLE: Uint16Array = (() => {
  const table = new Uint16Array(256)
  for (let byte = 0; byte < 256; byte++) {
    table[byte] = byte < 0x80 || byte > 0x9f ? byte : (HIGH[byte - 0x80] ?? byte)
  }
  return table
})()

/** The bytes CP1252 leaves undefined. Their presence is a note, never a rejection (§5.3). */
const UNDEFINED = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d])

/** Long enough to amortise the call, short of any engine's argument limit. */
const CHUNK = 4096

export interface DecodeReport {
  text: string
  /** Occurrences of the five bytes CP1252 does not define. `enc-mojibake-0x81` carries two. */
  undefinedByteCount: number
  /**
   * Runs that would also decode as a valid multi-byte UTF-8 sequence — a file that arrived
   * through something that already re-encoded it. Recorded so the mojibake is visible in
   * `issues[]`; the CP1252 reading still stands, because guessing per-run is how a file ends
   * up half in each encoding.
   */
  utf8SequenceCount: number
  /** Any byte ≥ `0x80`. Zero on a pure-ASCII export, which most of the real set is. */
  highByteCount: number
}

/** The common case: text, and nothing to say about how it was decoded. */
export function decodeCp1252(bytes: Uint8Array): string {
  return decodeCp1252WithReport(bytes).text
}

export function decodeCp1252WithReport(bytes: Uint8Array): DecodeReport {
  const codes = new Uint16Array(CHUNK)
  const parts: string[] = []
  let undefinedByteCount = 0
  let highByteCount = 0
  let held = 0

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number
    if (byte >= 0x80) {
      highByteCount++
      if (UNDEFINED.has(byte)) undefinedByteCount++
    }
    codes[held++] = TABLE[byte] as number
    if (held === CHUNK) {
      parts.push(String.fromCharCode(...codes))
      held = 0
    }
  }
  if (held > 0) parts.push(String.fromCharCode(...codes.subarray(0, held)))

  return {
    text: parts.join(''),
    undefinedByteCount,
    highByteCount,
    // Only worth a second pass over the bytes when there is something for it to find.
    utf8SequenceCount: highByteCount === 0 ? 0 : countUtf8Sequences(bytes),
  }
}

function countUtf8Sequences(bytes: Uint8Array): number {
  let count = 0
  for (let i = 0; i < bytes.length; ) {
    const lead = bytes[i] as number
    const width = lead >= 0xf0 && lead <= 0xf4 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc2 ? 2 : 0
    if (width === 0 || lead < 0xc2 || i + width > bytes.length) {
      i++
      continue
    }
    let ok = true
    for (let j = 1; j < width; j++) {
      const cont = bytes[i + j] as number
      if (cont < 0x80 || cont > 0xbf) ok = false
    }
    if (!ok) {
      i++
      continue
    }
    count++
    i += width
  }
  return count
}
