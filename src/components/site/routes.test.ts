import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import { FOOTER_LINKS, PUBLIC_ROUTES, SHELF_QUERY_PARAMS, SITEMAP_STATIC_ROUTES } from './routes'

describe('the footer (§7.14)', () => {
  it('is exactly six links, in order', () => {
    expect(FOOTER_LINKS.map((link) => link.label)).toEqual([
      'About',
      'Terms',
      'Privacy',
      'Contributors',
      'Report a problem',
      'Source',
    ])
  })

  it('carries no mailto: — the mailbox is printed on /report only (§7.19)', () => {
    for (const link of FOOTER_LINKS) {
      expect(link.href.startsWith('mailto:')).toBe(false)
    }
  })

  it('does not repeat the header nav', () => {
    const hrefs = FOOTER_LINKS.map((link) => link.href)
    expect(hrefs).not.toContain('/')
    expect(hrefs).not.toContain('/upload')
    expect(hrefs).not.toContain('/me')
  })
})

describe('robots.txt (§7.16.1)', () => {
  const file = robots()
  const rules = Array.isArray(file.rules) ? file.rules : [file.rules]
  const rule = rules[0]
  const disallow = rule?.disallow
  const disallowed = Array.isArray(disallow) ? disallow : disallow ? [disallow] : []

  it('is one User-agent: * group, with no per-agent rule and no AI-crawler block', () => {
    expect(rules).toHaveLength(1)
    expect(rule?.userAgent).toBe('*')
  })

  it('disallows every shelf query parameter, derived from the constant', () => {
    for (const param of SHELF_QUERY_PARAMS) {
      expect(disallowed).toContain(`/*?*${param}=`)
    }
  })

  it('leaves `page=` crawlable on purpose', () => {
    expect(disallowed).not.toContain('/*?*page=')
    expect(disallowed.some((line) => line.includes('page='))).toBe(false)
  })

  it('disallows the authenticated surfaces', () => {
    expect(disallowed).toEqual(expect.arrayContaining(['/me/', '/ops', '/api/']))
  })

  it('contains no bare `Disallow: /` — the copy-paste this file defends against', () => {
    // The blob host's file on a different origin says exactly that (§7.9). A site serving
    // it looks completely normal and is completely invisible.
    expect(disallowed).not.toContain('/')
    expect(rule?.allow).toBe('/')
  })

  it('has no Crawl-delay and no Noindex line', () => {
    expect(JSON.stringify(file).toLowerCase()).not.toContain('crawldelay')
    expect(JSON.stringify(file).toLowerCase()).not.toContain('crawl-delay')
    expect(JSON.stringify(file).toLowerCase()).not.toContain('noindex')
  })

  it('names the sitemap', () => {
    expect(String(file.sitemap)).toMatch(/\/sitemap\.xml$/)
  })
})

describe('the route constants (§6.1)', () => {
  it('lists the six static routes the sitemap carries', () => {
    expect([...SITEMAP_STATIC_ROUTES]).toEqual([
      '/',
      '/about',
      '/terms',
      '/privacy',
      '/contributors',
      '/report',
    ])
  })

  it('keeps every public route out of the clerkMiddleware matcher', () => {
    // The shipped matcher (§4.6.1). Adding a public route that this matches would put a
    // billed Function invocation in front of every cache hit — and a `Set-Cookie` on a
    // response Vercel then refuses to cache.
    const matched = /^\/(me|ops|api|__clerk)(\/|$)/
    for (const route of PUBLIC_ROUTES) {
      expect(matched.test(route), `${route} is inside the middleware matcher`).toBe(false)
    }
  })

  it('never lets the shelf parameters include `page`', () => {
    expect([...SHELF_QUERY_PARAMS]).toEqual(['sector', 'size', 'p6', 'progressed', 'q', 'sort'])
  })
})
