/**
 * What a facet value is called on a chip, in an active-filter chip, and in the empty
 * state's sentence. One place, so the three cannot drift.
 */

import { SECTORS, type SectorCode, type SizeBandCode, sectorLabel } from '@/lib/contracts/domain'

/**
 * The size bands as §1.5 words them, rather than as the half-open integer ranges the
 * predicate uses. The chip has to answer *is my programme in this band*, and `2,000–5,000`
 * answers it where `2,001–5,000` reads as a trick question.
 *
 * The `xl` edge was pulled down from 10,000 to 5,000 so the band stays plausibly occupied
 * rather than always empty (§6.3).
 */
export const SIZE_BAND_LABELS: Record<SizeBandCode, string> = {
  s: '< 500',
  m: '500–2,000',
  l: '2,000–5,000',
  xl: '> 5,000',
}

export function sizeBandLabel(code: string): string {
  return SIZE_BAND_LABELS[code as SizeBandCode] ?? code
}

/** The eight seeded codes in `sort_order` — transport → vertical → utilities → process. */
export const SECTOR_CHIPS: readonly { code: SectorCode; label: string }[] = SECTORS.map((s) => ({
  code: s.code,
  label: s.label,
}))

/**
 * The label an active-filter chip prints. A sector prints its label, a size band its
 * range, a P6 version `P6 19.12`, and the search term the term itself in quotes.
 */
export function facetValueLabel(facet: 'sector' | 'size' | 'p6', value: string): string {
  if (facet === 'sector') return sectorLabel(value) ?? value
  if (facet === 'size') return sizeBandLabel(value)
  return `P6 ${value}`
}
