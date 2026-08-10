'use client'

import { useEffect, useRef } from 'react'
import styles from './ShelfControls.module.css'

/**
 * The shelf's frozen chrome: the filter bar, the result count and sort control, and the
 * active-filter chips, held under the site header while the rows scroll under all of it.
 *
 * One sticky band rather than three, because the three are one object — they are the state
 * of the set you are looking at, and a filter chip that scrolls away while the column it
 * filters stays put is worse than neither being frozen. It publishes its own height as
 * `--shelf-controls-h`, which is what the grid's column labels add to `--site-header-h` to
 * find their own resting place; the property is removed on unmount, so the pages that render
 * a grid with no chrome above it (`/u/{handle}`, `/me/bookmarks`, `/me/votes`) fall back to
 * nothing rather than to this page's leftovers.
 */
export function ShelfChrome({ children }: { children: React.ReactNode }) {
  const band = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = band.current
    if (!element) return

    const root = document.documentElement
    const publish = () => {
      root.style.setProperty('--shelf-controls-h', `${element.getBoundingClientRect().height}px`)
    }

    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--shelf-controls-h')
    }
  }, [])

  return (
    <div ref={band} className={styles.chrome}>
      {children}
    </div>
  )
}
