import { describe, expect, it } from 'vitest'
import { PUBLIC_ROUTES } from '@/components/site/routes'
import { config } from './middleware'

/**
 * `ci.middleware.public_routes_excluded` (§4.6.6), as a unit test: evaluate the exported
 * matcher against `PUBLIC_ROUTES` and assert that **no public route matches it**.
 *
 * Adding a public route without excluding it from the matcher is then a test failure rather
 * than a silently uncached page discovered by a bill.
 */

/** The subset of the matcher grammar this file uses: `:param`, `:param*` and `(.*)`. */
function toRegExp(pattern: string): RegExp {
  let source = ''
  for (const segment of pattern.split('/').slice(1)) {
    if (segment.endsWith('*')) source += '(?:/[^/]+)*'
    else if (segment.startsWith(':')) source += '/[^/]+'
    else if (segment === '(.*)') source += '/.*'
    else source += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  }
  return new RegExp(`^${source}$`)
}

const matchers = config.matcher.map(toRegExp)

const covered = (path: string) => matchers.some((matcher) => matcher.test(path))

/** `/p/:slug` → `/p/riverside-depot`. Dynamic segments are written in `:param` form. */
const sample = (route: string) => route.replace(/:[a-z]+/gi, 'riverside-depot')

describe('the clerkMiddleware matcher (§4.6.1, §4.7, §10.1)', () => {
  it('covers no public route', () => {
    for (const route of PUBLIC_ROUTES) {
      expect({ route, covered: covered(sample(route)) }).toEqual({ route, covered: false })
    }
  })

  it('covers a shelf URL carrying facets, which is the same path as `/`', () => {
    expect(covered('/')).toBe(false)
  })

  it('covers the four authenticated prefixes of §4.7', () => {
    expect(covered('/me')).toBe(true)
    expect(covered('/me/bookmarks')).toBe(true)
    expect(covered('/ops')).toBe(true)
    expect(covered('/api/viewer')).toBe(true)
    expect(covered('/__clerk/frontend-api')).toBe(true)
  })

  it('covers the three upload routes of §10.1 — the fourth, fifth and sixth', () => {
    expect(covered('/upload')).toBe(true)
    expect(covered('/p/riverside-depot/upload')).toBe(true)
    expect(covered('/p/riverside-depot/fork')).toBe(true)
  })

  it('leaves the programme page and its revision URLs outside', () => {
    expect(covered('/p/riverside-depot')).toBe(false)
    expect(covered('/p/riverside-depot/r/7')).toBe(false)
  })

  it('names seven prefixes and no more', () => {
    expect(config.matcher).toHaveLength(7)
  })
})
