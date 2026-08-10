'use client'

import { useEffect, useRef } from 'react'

/**
 * Publishes the site header's rendered height as `--site-header-h` on the root element.
 *
 * The header is `position: sticky` and everything that freezes under it — the shelf's
 * filter/sort chrome, and the grid's column labels under that — has to know how tall it is
 * to pick its own `top`. That height is not a constant anyone can write down: the bar wraps
 * at narrow widths, and `HeaderNotice` adds a line for the rare signed-in viewer inside a
 * 24-hour or 30-day window (§6.12), which is exactly the case a hard-coded offset gets
 * wrong. A `ResizeObserver` on the header itself is the only value that is always true.
 *
 * It renders a hidden marker rather than taking a ref, because `SiteHeader` is a server
 * component and the element being measured is its own `<header>`.
 */
export function HeaderMetrics() {
  const marker = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const header = marker.current?.parentElement
    if (!header) return

    const root = document.documentElement
    const publish = () => {
      root.style.setProperty('--site-header-h', `${header.getBoundingClientRect().height}px`)
    }

    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(header)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--site-header-h')
    }
  }, [])

  return <span ref={marker} hidden />
}
