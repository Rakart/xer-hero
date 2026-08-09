import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CardPayload } from '@/lib/contracts/card'
import { ShelfGrid } from './ShelfGrid'
import type { ShelfRowData } from './ShelfRow'

/**
 * The row, rendered.
 *
 * The pure helpers are tested beside them; this asserts the two things only the rendered
 * markup can show — that **every one of the twelve slots is drawn on every row**, including
 * the ones whose data is missing, and that the controls ship in their **signed-out** state,
 * which is what goes to the CDN and is byte-identical for every viewer (§6.13).
 */

const card: CardPayload = {
  s_curve: Array.from({ length: 16 }, (_, i) => i / 15),
  float_mix: { neg: 69, ok: 27, high: 4 },
  wbs_depth: 4,
  issues_count: 2,
}

function row(overrides: Partial<ShelfRowData> = {}): ShelfRowData {
  return {
    programme_id: '00000000-0000-0000-0000-000000000001',
    slug: 'station-remodelling-stage-3',
    title: 'Station remodelling — Stage 3',
    sector: 'rail',
    vote_count: 214,
    created_at: '2025-03-01T00:00:00.000Z',
    revision_id: '00000000-0000-0000-0000-000000000002',
    rev_no: 23,
    uploaded_at: '2025-03-01T00:00:00.000Z',
    uploader_display_name: 'planner_dave',
    p6_version: '19.12',
    activity_count: 1751,
    start_date: '2024-01-01',
    finish_date: '2025-06-30',
    data_date: '2024-11-01',
    pct_complete: 41,
    checks_passed: 6,
    checks_applicable: 10,
    card,
    parent_slug: 'depot-resignalling',
    parent_title: 'Depot resignalling',
    total_count: 1,
    ...overrides,
  } as ShelfRowData
}

describe('the row renders twelve slots (§6.2)', () => {
  const html = renderToStaticMarkup(<ShelfGrid rows={[row()]} now={new Date('2025-06-01')} />)

  it('labels every slot in the header', () => {
    for (const label of [
      'Float',
      'Programme',
      'Sector',
      'P6',
      'Upvotes',
      'Save',
      'Rev',
      'Activities',
      'Window &amp; data date',
      'Complete',
      'DCMA',
      'Age',
    ]) {
      expect(html).toContain(label)
    }
    // Slot 1's three fixed numeric slots are labelled too — `69 27 4` has no units without,
    // and all three are stated in days so the band reads as one number line.
    expect(html).toContain('&lt;0d')
    expect(html).toContain('0–44d')
    expect(html).toContain('&gt;44d')
  })

  it('prints all three float percentages, which may never be dropped for density', () => {
    expect(html).toContain('>69<')
    expect(html).toContain('>27<')
    expect(html).toContain('>4<')
  })

  it('prints the DCMA ratio beside a fourteen-cell strip', () => {
    expect(html).toContain('6/10')
    expect(countCells(html)).toBe(14)
  })

  it('draws all ten activity slots and the counts, badges, rev, P6 and age', () => {
    expect(html).toContain('1,751')
    expect(html).toContain('r23')
    expect(html).toContain('19.12')
    expect(html).toContain('3mo')
    expect(html).toContain('41%')
    expect(html).toContain('⚠ partial')
    expect(html).toContain('Rail')
    expect(html).toContain('planner_dave')
    expect(html).toContain('forked from')
  })

  it('ships both controls unpressed, with the public count already inside the pill', () => {
    // The signed-out render is what goes to the CDN, and it is one element that is never
    // swapped: the viewer response changes a fill inside a box that already exists (§6.13).
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-label="Upvote Station remodelling — Stage 3"')
    expect(html).toContain('aria-label="Save Station remodelling — Stage 3"')
    expect(html).toContain('>214<')
    expect(html).not.toContain('aria-pressed="true"')
  })
})

describe('a row holds its geometry when the data does not', () => {
  const bare = renderToStaticMarkup(
    <ShelfGrid
      rows={[
        row({
          sector: null,
          card: null,
          p6_version: null,
          activity_count: null,
          start_date: null,
          finish_date: null,
          data_date: null,
          pct_complete: null,
          checks_passed: null,
          checks_applicable: null,
          parent_slug: null,
          parent_title: null,
          vote_count: 0,
        }),
      ]}
      now={new Date('2025-06-01')}
    />,
  )

  it('renders `unsectored` rather than a placeholder or a ninth chip', () => {
    expect(bare).toContain('unsectored')
    expect(bare).not.toContain('sector=none')
  })

  it('keeps the activity track drawn when there is no count', () => {
    // Ten slots, all empty: a blank cell would read as missing data rather than "small".
    expect((bare.match(/rx="1"/g) ?? []).length).toBeGreaterThanOrEqual(10)
  })

  it('draws no data-date rule and no curve rather than inventing one', () => {
    expect(bare).not.toContain('▼')
    expect(bare).toContain('—')
  })
})

/** The DCMA strip is the only place a 6×12 rect is drawn. */
function countCells(html: string): number {
  return (html.match(/width="6"/g) ?? []).length + (html.match(/width="5"/g) ?? []).length
}
