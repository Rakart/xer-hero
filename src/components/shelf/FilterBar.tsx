import { Chip } from '@/components/site'
import { SIZE_BANDS } from '@/lib/contracts/domain'
import type { ShelfFacetCounts } from '@/lib/db/queries'
import { SECTOR_CHIPS, sizeBandLabel } from './facet-labels'
import styles from './ShelfControls.module.css'
import {
  type ListFacet,
  type ShelfParams,
  shelfHref,
  toggleFacetValue,
  toggleProgressed,
} from './shelf-url'

/**
 * The four facets, as a **top filter bar and never a left rail** (§6.3).
 *
 * A rail costs ~20% of viewport permanently, and the columns that compress under it are the
 * drawn ones — whose legibility is a relief rule rather than decoration. Four facets cost
 * four clicks; twelve would not have been acceptable, which is also why there are four.
 *
 * Every count is **live and conjunctive**: computed against the current WHERE clause minus
 * that facet's own predicate, because otherwise selecting "rail" makes every other sector
 * read zero. **Zero-count values render disabled, not hidden** — a control list that shrinks
 * as you filter jumps under the cursor, and a greyed `Highways & roads (0)` is information.
 * Static whole-catalogue counts were the trap option: `Rail (12)` that yields zero rows once
 * size is applied is worse than no number at all.
 *
 * These counts are also the estate's only visitor-independent measuring instrument, and the
 * trigger for `/sector/{code}` (§6.6) is read off them: four of the eight codes each holding
 * ≥ 25 published programmes. The route is deliberately not built in v1 and the chips keep
 * linking to `?sector=…` until it is.
 */
export function FilterBar({ params, counts }: { params: ShelfParams; counts: ShelfFacetCounts }) {
  return (
    <div className={styles.filters}>
      <FacetGroup label="Sector">
        {SECTOR_CHIPS.map((sector) => (
          <FacetChip
            key={sector.code}
            label={sector.label}
            count={counts.sector[sector.code] ?? 0}
            params={params}
            facet="sector"
            value={sector.code}
          />
        ))}
      </FacetGroup>

      <FacetGroup label="Size">
        {SIZE_BANDS.map((band) => (
          <FacetChip
            key={band.code}
            label={sizeBandLabel(band.code)}
            title={`${band.label} — ${sizeBandLabel(band.code)} activities`}
            count={counts.size[band.code] ?? 0}
            params={params}
            facet="size"
            value={band.code}
          />
        ))}
      </FacetGroup>

      {/* A *can I use this* filter: a newer `.xer` will not import into an older P6, so the
          values are whatever the catalogue holds rather than a list anyone seeded. */}
      <FacetGroup label="P6 version">
        {p6Values(counts, params).map((version) => (
          <FacetChip
            key={version}
            label={version}
            title={`Exported from P6 ${version}`}
            count={counts.p6[version] ?? 0}
            params={params}
            facet="p6"
            value={version}
          />
        ))}
      </FacetGroup>

      <FacetGroup label="Progress">
        <Chip
          href={shelfHref(toggleProgressed(params))}
          selected={params.progressed}
          disabled={counts.progressed === 0 && !params.progressed}
          count={counts.progressed}
          title="Some work has been recorded against the programme"
        >
          Progressed
        </Chip>
      </FacetGroup>
    </div>
  )
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      <div className={styles.chips}>{children}</div>
    </div>
  )
}

/**
 * One value. A **selected** chip is never disabled even at zero: its own count is the count
 * of the shelf you are looking at, so an empty result would otherwise trap the visitor
 * inside a filter they can no longer clear.
 */
function FacetChip({
  label,
  title,
  count,
  params,
  facet,
  value,
}: {
  label: string
  title?: string
  count: number
  params: ShelfParams
  facet: ListFacet
  value: string
}) {
  const selected = (params[facet] as string[]).includes(value)
  return (
    <Chip
      href={shelfHref(toggleFacetValue(params, facet, value))}
      selected={selected}
      disabled={count === 0 && !selected}
      count={count}
      title={title ?? label}
    >
      {label}
    </Chip>
  )
}

/**
 * The version strings present in the catalogue, oldest first — the order that puts the
 * broadest compatibility on the left — with any selected value that has fallen out of the
 * catalogue kept so the chip that produced this URL is still there to switch off.
 */
export function p6Values(counts: ShelfFacetCounts, params: ShelfParams): string[] {
  const values = new Set([...Object.keys(counts.p6), ...params.p6])
  return [...values].sort(compareP6Versions)
}

/**
 * `19.12` before `20.12` before `21.12.1`, and `unknown` last. Dotted numbers compared
 * segment by segment, because a string compare puts `9.0` after `19.12`.
 */
export function compareP6Versions(a: string, b: string): number {
  const left = a.split('.')
  const right = b.split('.')
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = Number(left[i] ?? '')
    const y = Number(right[i] ?? '')
    if (Number.isNaN(x) || Number.isNaN(y)) return a.localeCompare(b)
    if (x !== y) return x - y
  }
  return 0
}
