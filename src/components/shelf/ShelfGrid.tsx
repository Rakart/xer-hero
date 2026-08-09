import styles from './ShelfGrid.module.css'
import { ShelfRow, type ShelfRowData } from './ShelfRow'
import rowStyles from './ShelfRow.module.css'

/**
 * The twelve headers, in the order §6.2 tables them. Slot 1 carries three sub-labels of
 * its own, because the three float percentages under the sliver are fixed numeric slots and
 * an unlabelled `69 27 4` is three numbers with no units.
 */
const HEADERS = [
  'float',
  'programme',
  'sector',
  'P6',
  'upvotes',
  'save',
  'rev',
  'activities',
  'window & data date',
  'complete',
  'DCMA',
  'age',
] as const

const FLOAT_SUBHEADS = ['neg', '0–44d', '>44d'] as const

/**
 * The shelf: a sticky header row and one row per published Programme at its current
 * revision (§6.2).
 *
 * The row's twelve tracks sum to 1,362px — the twelve widths, eleven 12px gaps and the
 * row's 14px padding — which is two pixels more than the site's `--measure-wide`. The
 * shelf takes those two pixels rather than shaving a width the prototype fixed, and below
 * that width the grid scrolls sideways inside its own box rather than reflowing: **nothing
 * in a row may flow**, and a row that rewraps on a narrow viewport is the same failure as a
 * row whose facts land at a different x.
 */
export function ShelfGrid({ rows, now }: { rows: ShelfRowData[]; now?: Date }) {
  return (
    <div className={styles.scroller}>
      <div className={styles.grid}>
        <div className={`${rowStyles.row} ${rowStyles.headRow}`}>
          {HEADERS.map((label, index) =>
            index === 0 ? (
              <div key={label} className={rowStyles.cell}>
                <div className={rowStyles.headCell}>{label}</div>
                <div className={`${rowStyles.headCell} ${rowStyles.floatNumbers}`}>
                  {FLOAT_SUBHEADS.map((sub) => (
                    <span key={sub}>{sub}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div
                key={label}
                className={`${rowStyles.headCell} ${index === 6 || index === 11 ? rowStyles.right : ''}`}
              >
                {label}
              </div>
            ),
          )}
        </div>

        {/* A list, because that is what it is: one item per Programme, in an order the page
            states. The row inside each item is the grid; the `<li>` carries no geometry. */}
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.programme_id}>
              <ShelfRow row={row} now={now} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * A single result usually means you have found a variant of something, so the row keeps its
 * place and gains a line pointing at the fork family — which lives on the programme page,
 * because the grid refused a fork counter to hold its one-query rule (§6.2).
 */
export function SingleResultNote({ row }: { row: ShelfRowData }) {
  return (
    <p className={styles.single}>
      One programme. If it is a variant of something, its revisions and its fork family are on{' '}
      <a href={`/p/${row.slug}`}>its page</a>.
    </p>
  )
}
