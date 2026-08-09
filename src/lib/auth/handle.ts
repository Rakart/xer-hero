import { normaliseHandle } from '@/lib/identity'

/**
 * The Handle, as a pure module (§2.11, §6.12).
 *
 * It is isomorphic and imports nothing but `identity`, because the upload screen validates a
 * chosen Handle in the browser and `/api/submit` validates the same string on the server —
 * one rule, written once and run twice. The database half lives in `app-user.ts`, which is
 * server-only.
 */

const HANDLE_PREFIX = 'planner-'
/** Six hex characters — 16.7M values against a catalogue ceiling of 10,300 programmes. */
const HANDLE_HEX = 6
const MINT_ATTEMPTS = 50

/** Bounds on a *chosen* Handle at `/me/account`. The generated ones are 14 characters. */
export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 32

export function formatHandle(hex: string): string {
  return `${HANDLE_PREFIX}${hex}`
}

/** `planner-` + 6 hex characters (§6.12). Bytes are injectable so the shape is testable. */
export function mintHandle(bytes?: Uint8Array): string {
  const source = bytes ?? globalThis.crypto.getRandomValues(new Uint8Array(HANDLE_HEX))
  let hex = ''
  for (let i = 0; i < HANDLE_HEX; i++) {
    hex += ((source[i] ?? 0) & 0x0f).toString(16)
  }
  return formatHandle(hex)
}

/**
 * Regenerated on collision, exactly as `uniqueSlug` resolves a slug: `taken` is *asked*
 * rather than a table scanned, so the caller decides whether that is a query or a set held in
 * memory. A candidate is checked against `app_user.display_name` **and** `reserved_handle`,
 * because a Handle is never reassigned once retired — not even one generated and never
 * published.
 */
export async function uniqueHandle(
  taken: (candidate: string) => Promise<boolean>,
  mint: () => string = mintHandle,
): Promise<string> {
  for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt++) {
    const candidate = mint()
    if (!(await taken(candidate))) return candidate
  }
  throw new Error('Could not mint a free Handle')
}

/**
 * The sentence to show under a chosen Handle field, or `null` when it is acceptable. The
 * string is normalised first, so what is validated is exactly what would be stored.
 */
export function handleProblem(raw: string): string | null {
  // The length ceiling is measured on what was typed, not on what normalisation returns:
  // `normaliseHandle` truncates at 32, and silently keeping the first 32 characters of a
  // Handle someone chose is worse than telling them it is too long.
  if (raw.trim().length > HANDLE_MAX_LENGTH) {
    return `A Handle is at most ${HANDLE_MAX_LENGTH} characters.`
  }
  if (normaliseHandle(raw).length < HANDLE_MIN_LENGTH) {
    return `A Handle is at least ${HANDLE_MIN_LENGTH} characters — letters, digits and underscores.`
  }
  return null
}
