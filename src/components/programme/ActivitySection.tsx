'use client'

/**
 * The WBS rail and the virtualised activity table (§6.7, §6.8, §3.12).
 *
 * This is the only block on the page that is not server-rendered, and the reason is a
 * measurement rather than a preference. Against the real 20,000-activity cut in Chrome:
 * transfer 340 KB gzipped, fetch 8 ms, `JSON.parse` 15–19 ms, build 20,000 row objects
 * 2 ms — **25 ms from request to a sortable in-memory table** — then sort 1.8 ms, substring
 * search over 20,000 names 1.1 ms, virtualised scroll frame 0.35 ms, under 10 MB of tab
 * heap. An API pays a round trip per sort and per keystroke, 50–150 ms each, forever.
 *
 * Two rules follow and both are enforced here:
 *
 * - **A visitor who never reaches the table never fetches `activities.json`.** The fetch is
 *   triggered by an `IntersectionObserver` on approach, so a visitor who reads the charts
 *   and leaves pays nothing for the largest object the site serves per open.
 * - **After the fetch the page issues no further requests.** Sort, filter, search, WBS
 *   selection and the exemplar deep-links are all local.
 *
 * The object lives on the blob host, so this fetch never touches the platform's transfer
 * meters — the largest per-open object in the estate is invisible to the thing that meters
 * transfer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActivitiesPayload } from '@/lib/contracts/activities'
import styles from './activities.module.css'
import {
  buildRows,
  buildWbsTree,
  type CheckFilter,
  EMPTY_FILTERS,
  filterRows,
  rowCountLabel,
  type SortKey,
  sortRows,
  statusLabel,
  subtreeIds,
  type TableFilters,
  type WbsNode,
  windowRange,
} from './activity-model'
import { formatCount, formatDate } from './format'

const ROW_HEIGHT = 28
const VIEWPORT_HEIGHT = 460

type LoadState = 'idle' | 'loading' | 'ready' | 'failed'

const COLUMNS: Array<{ key: SortKey; label: string; right?: boolean }> = [
  { key: 'code', label: 'Activity ID' },
  { key: 'name', label: 'Activity name' },
  { key: 'wbsCode', label: 'WBS' },
  { key: 'statusCode', label: 'Status' },
  { key: 'durationDays', label: 'Dur', right: true },
  { key: 'floatDays', label: 'Total float', right: true },
  { key: 'start', label: 'Start', right: true },
  { key: 'finish', label: 'Finish', right: true },
]

export function ActivitySection({
  activitiesUrl,
  activityCount,
  wbsDepth,
  noWbsPanel,
}: {
  activitiesUrl: string
  activityCount: number
  wbsDepth: number
  /** Rendered on the server and handed in, so the depth-1 copy lives in one place. */
  noWbsPanel: React.ReactNode
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [load, setLoad] = useState<LoadState>('idle')
  const [payload, setPayload] = useState<ActivitiesPayload | null>(null)
  const [request, setRequest] = useState<CheckRequest | null>(null)

  const fetchPayload = useCallback(() => {
    setLoad((current) => {
      if (current !== 'idle' && current !== 'failed') return current
      void fetch(activitiesUrl, { headers: { accept: 'application/json' } })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status))
          return response.json() as Promise<ActivitiesPayload>
        })
        .then((body) => {
          setPayload(body)
          setLoad('ready')
        })
        .catch(() => setLoad('failed'))
      return 'loading'
    })
  }, [activitiesUrl])

  // On approach, not on mount: 600px of margin is roughly one scroll flick, which is
  // enough for the 25 ms parse to be finished before the table is looked at.
  useEffect(() => {
    const node = anchorRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fetchPayload()
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchPayload])

  /**
   * *Open all 2,530 in the activity table →*.
   *
   * The exemplar deep-links are plain server-rendered anchors carrying the check id, and
   * this delegated listener is the only wire between the scorecard and the table: no shared
   * store, no context, and nothing that has to exist before the payload does. It lives up
   * here rather than in the table because the click is usually what *causes* the fetch — a
   * listener mounted with the table would miss the click that summoned it.
   */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[data-activity-filter]')
      const check = anchor?.getAttribute('data-activity-filter') as CheckFilter | null
      if (!check) return
      // A nonce, so clicking the same link twice after clearing the chip re-applies it.
      setRequest({ check, nonce: Date.now() })
      fetchPayload()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [fetchPayload])

  return (
    <div ref={anchorRef}>
      {load === 'ready' && payload ? (
        <LoadedTable
          payload={payload}
          wbsDepth={wbsDepth}
          noWbsPanel={noWbsPanel}
          request={request}
        />
      ) : (
        // The rail is drawn before the fetch, because at `wbs_depth: 1` it does not need
        // the payload at all: its whole content is a server-rendered statement about the
        // file's shape, and hiding that behind a lazy fetch would put the page's answer to
        // "why is there no tree here" behind a scroll.
        <div className={styles.layout}>
          <div className={`${styles.card} ${styles.rail}`}>
            {wbsDepth === 1 ? noWbsPanel : <div className={styles.placeholder}>Work breakdown</div>}
          </div>
          <div className={`${styles.card} ${styles.placeholder}`}>
            {load === 'failed' ? (
              <>
                The activity payload did not load.{' '}
                <button type="button" className={styles.pill} onClick={fetchPayload}>
                  Try again
                </button>
              </>
            ) : (
              <>{formatCount(activityCount)} activities, loaded on approach</>
            )}
          </div>
        </div>
      )}
      <p className={styles.note}>
        The activity table reads one object from the blob host on approach, and issues no request
        after that: sorting, searching, the status pills and the WBS selection are all done in this
        tab. Durations and floats are printed in days at eight hours, the same conversion DCMA
        checks 6 and 8 use.
      </p>
    </div>
  )
}

/** A click on an exemplar deep-link, carried across the fetch that the click started. */
type CheckRequest = { check: CheckFilter; nonce: number }

function LoadedTable({
  payload,
  wbsDepth,
  noWbsPanel,
  request,
}: {
  payload: ActivitiesPayload
  wbsDepth: number
  noWbsPanel: React.ReactNode
  request: CheckRequest | null
}) {
  const tree = useMemo(() => buildWbsTree(payload.wbs, payload.activities.wbs_id), [payload])
  const rows = useMemo(() => buildRows(payload, tree.codes), [payload, tree])
  const drivingCount = useMemo(() => rows.filter((row) => row.driving).length, [rows])

  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS)
  const [selected, setSelected] = useState<WbsNode | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({
    key: 'code',
    direction: 1,
  })

  const visible = useMemo(
    () => sortRows(filterRows(rows, filters), sort.key, sort.direction),
    [rows, filters, sort],
  )

  // A check's whole population, applied as a client-side predicate. This is what makes the
  // 50-exemplar cap acceptable: the full list is one filter away, because the client holds
  // every row.
  useEffect(() => {
    if (!request) return
    setFilters((current) => ({ ...current, check: request.check, wbsSubtree: null }))
    setSelected(null)
  }, [request])

  const selectNode = (node: WbsNode) => {
    setSelected(node)
    setFilters((current) => ({ ...current, wbsSubtree: subtreeIds(tree, node.id) }))
  }

  return (
    <div className={styles.layout}>
      <div className={`${styles.card} ${styles.rail}`}>
        {wbsDepth === 1 || tree.roots.length === 0 ? (
          noWbsPanel
        ) : (
          <WbsRail tree={tree.roots} selectedId={selected?.id ?? null} onSelect={selectNode} />
        )}
      </div>

      <div className={`${styles.card} ${styles.tableCard}`}>
        <Toolbar
          total={rows.length}
          shown={visible.length}
          filters={filters}
          setFilters={setFilters}
          selected={selected}
          clearSelection={() => {
            setSelected(null)
            setFilters((current) => ({ ...current, wbsSubtree: null }))
          }}
          drivingCount={drivingCount}
        />
        <Head sort={sort} setSort={setSort} />
        <Viewport rows={visible} />
      </div>
    </div>
  )
}

/** Root expanded, everything else collapsed; counts rolled up from the subtree. */
function WbsRail({
  tree,
  selectedId,
  onSelect,
}: {
  tree: WbsNode[]
  selectedId: number | null
  onSelect: (node: WbsNode) => void
}) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(tree.map((node) => node.id)))

  const render = (node: WbsNode): React.ReactNode => {
    const isOpen = open.has(node.id)
    return (
      <div key={node.id}>
        {/*
          Two real buttons rather than one with a clickable span inside it: expanding a
          branch and filtering the table to it are different acts, and a keyboard visitor
          needs to be able to do the first without doing the second.
        */}
        <div className={styles.node} style={{ paddingLeft: 6 + node.depth * 13 }}>
          <button
            type="button"
            className={styles.twisty}
            disabled={node.children.length === 0}
            aria-expanded={node.children.length === 0 ? undefined : isOpen}
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={() =>
              setOpen((current) => {
                const next = new Set(current)
                if (next.has(node.id)) next.delete(node.id)
                else next.add(node.id)
                return next
              })
            }
          >
            {node.children.length > 0 ? (isOpen ? '▾' : '▸') : ''}
          </button>
          <button
            type="button"
            className={`${styles.nodeLabel} ${selectedId === node.id ? styles.nodeOn : ''}`}
            onClick={() => onSelect(node)}
            title={`${node.code} ${node.name}`}
          >
            {node.name}
          </button>
          <span className={styles.nodeCount}>{formatCount(node.total)}</span>
        </div>
        {isOpen ? node.children.map(render) : null}
      </div>
    )
  }

  return <div className={styles.tree}>{tree.map(render)}</div>
}

function Toolbar({
  total,
  shown,
  filters,
  setFilters,
  selected,
  clearSelection,
  drivingCount,
}: {
  total: number
  shown: number
  filters: TableFilters
  setFilters: (update: (current: TableFilters) => TableFilters) => void
  selected: WbsNode | null
  clearSelection: () => void
  drivingCount: number
}) {
  const statuses: Array<[TableFilters['status'], string]> = [
    ['all', 'All'],
    ['TK_NotStart', 'Not started'],
    ['TK_Active', 'In progress'],
    ['TK_Complete', 'Complete'],
  ]

  return (
    <div className={styles.toolbar}>
      <input
        type="search"
        className={styles.search}
        placeholder={`Search ${formatCount(total)} activities`}
        value={filters.query}
        onChange={(event) => {
          const query = event.target.value
          setFilters((current) => ({ ...current, query }))
        }}
      />
      {statuses.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={`${styles.pill} ${filters.status === value ? styles.pillOn : ''}`}
          onClick={() => setFilters((current) => ({ ...current, status: value }))}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.pill} ${filters.floatAtOrBelowZero ? styles.pillOn : ''}`}
        onClick={() =>
          setFilters((current) => ({
            ...current,
            floatAtOrBelowZero: !current.floatAtOrBelowZero,
          }))
        }
      >
        Float ≤ 0
      </button>
      {/*
        Over our own computed driving-path boolean, never the file's `driving_path_flag`: a
        stat whose method flips per file cannot be compared across programmes. The chip is
        what lets a planner check our answer against their own file rather than being asked
        to trust it.
      */}
      <button
        type="button"
        className={`${styles.pill} ${filters.drivingOnly ? styles.pillOn : ''}`}
        onClick={() => setFilters((current) => ({ ...current, drivingOnly: !current.drivingOnly }))}
      >
        Longest path ({formatCount(drivingCount)})
      </button>
      {filters.check ? (
        <button
          type="button"
          className={`${styles.pill} ${styles.pillOn}`}
          onClick={() => setFilters((current) => ({ ...current, check: null }))}
        >
          {filters.check === 'negative_float'
            ? 'Negative float'
            : filters.check === 'high_float'
              ? 'Float over 44d'
              : 'Duration over 44d'}{' '}
          ✕
        </button>
      ) : null}
      {selected ? (
        <button
          type="button"
          className={`${styles.pill} ${styles.pillOn}`}
          onClick={clearSelection}
        >
          {selected.code} {selected.name} ✕
        </button>
      ) : null}
      <span className={styles.spacer} />
      <span className={styles.count}>{rowCountLabel(shown, total)}</span>
    </div>
  )
}

function Head({
  sort,
  setSort,
}: {
  sort: { key: SortKey; direction: 1 | -1 }
  setSort: (next: { key: SortKey; direction: 1 | -1 }) => void
}) {
  return (
    <div className={styles.head}>
      {COLUMNS.map((column) => (
        <span key={column.key} className={column.right ? styles.headRight : undefined}>
          <button
            type="button"
            onClick={() =>
              setSort(
                sort.key === column.key
                  ? { key: column.key, direction: sort.direction === 1 ? -1 : 1 }
                  : { key: column.key, direction: 1 },
              )
            }
          >
            {column.label}
            {sort.key === column.key ? (sort.direction === 1 ? ' ▲' : ' ▼') : ''}
          </button>
        </span>
      ))}
    </div>
  )
}

/** 23 DOM rows for 20,000, on a fixed row height with six rows of overscan either side. */
function Viewport({ rows }: { rows: ReturnType<typeof filterRows> }) {
  const [scrollTop, setScrollTop] = useState(0)
  const { first, last } = windowRange(scrollTop, VIEWPORT_HEIGHT, ROW_HEIGHT, rows.length)

  if (rows.length === 0) {
    return <div className={styles.emptyResult}>No activity matches these filters.</div>
  }

  return (
    <div
      className={styles.viewport}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className={styles.spacerV} style={{ height: rows.length * ROW_HEIGHT }}>
        <div className={styles.window} style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}>
          {rows.slice(first, last).map((row) => (
            <div className={styles.row} key={row.index}>
              <span>{row.code}</span>
              <span className={styles.name}>
                {row.isMilestone ? <span className={styles.milestone}>◆ </span> : null}
                {row.name}
              </span>
              <span className={styles.wbs}>{row.wbsCode}</span>
              <span className={styles.status}>
                <i
                  className={
                    row.statusCode === 'TK_Complete'
                      ? styles.dotComplete
                      : row.statusCode === 'TK_Active'
                        ? styles.dotActive
                        : styles.dotNotStarted
                  }
                />
                {statusLabel(row.statusCode)}
              </span>
              <span className={styles.right}>
                {row.durationDays === null ? (
                  <span className={styles.empty}>—</span>
                ) : (
                  `${row.durationDays}d`
                )}
              </span>
              <span className={styles.right}>
                {row.floatDays === null ? (
                  <span className={styles.empty}>—</span>
                ) : (
                  <span
                    className={
                      row.floatDays < 0
                        ? styles.negative
                        : row.floatDays > 44
                          ? styles.high
                          : undefined
                    }
                  >
                    {row.floatDays}d
                  </span>
                )}
              </span>
              <span className={styles.right}>{formatDate(row.start)}</span>
              <span className={styles.right}>{formatDate(row.finish)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
