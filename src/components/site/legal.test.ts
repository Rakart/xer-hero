import { describe, expect, it } from 'vitest'
import {
  CURRENT_TERMS_VERSION,
  LEGAL_KINDS,
  LEGAL_VERSION_DATES,
  legalCrawlDirectives,
  legalHref,
  readLegalDocument,
  shippedVersions,
  versionNumber,
} from './legal'

describe('versionNumber', () => {
  it('reads the `v{n}` string that `terms_version` stores', () => {
    expect(versionNumber('v1')).toBe(1)
    expect(versionNumber('v12')).toBe(12)
  })

  it('rejects anything that is not a version, which is how an unknown path 404s', () => {
    for (const bad of ['1', 'v', 'v0', 'v-1', 'v1.2', '../terms', 'vX', '']) {
      expect(versionNumber(bad)).toBeNull()
    }
  })
})

describe('the version scheme', () => {
  it('names both documents with one number — CI asserts both files exist (§7.10)', () => {
    for (const kind of LEGAL_KINDS) {
      expect(readLegalDocument(kind, CURRENT_TERMS_VERSION).length).toBeGreaterThan(0)
    }
  })

  it('ships terms and privacy as a pair at every version', () => {
    for (const version of shippedVersions()) {
      for (const kind of LEGAL_KINDS) {
        expect(() => readLegalDocument(kind, version)).not.toThrow()
      }
    }
  })

  it('includes the current version among the shipped ones, and dates every one', () => {
    expect(shippedVersions()).toContain(CURRENT_TERMS_VERSION)
    for (const version of shippedVersions()) {
      expect(LEGAL_VERSION_DATES[version]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('resolves a stored version to the two URLs of §7.10', () => {
    expect(legalHref('terms', 'v3')).toBe('/terms/v3')
    expect(legalHref('privacy', 'v3')).toBe('/privacy/v3')
  })
})

describe('crawl directives for a numbered legal URL (§7.16.3)', () => {
  it('canonicalises the current version to the bare route and never noindexes it', () => {
    for (const kind of LEGAL_KINDS) {
      const directives = legalCrawlDirectives(kind, CURRENT_TERMS_VERSION)
      expect(directives).toEqual({ canonical: `/${kind}`, noindex: false })
    }
  })

  it('self-canonicalises a superseded version and noindexes it', () => {
    // Never a canonical pointing at the current text: that claims two documents are the
    // same, which is the exact thing the audit trail depends on being false.
    const superseded = 'v0'
    for (const kind of LEGAL_KINDS) {
      const directives = legalCrawlDirectives(kind, superseded)
      expect(directives).toEqual({ canonical: `/${kind}/${superseded}`, noindex: true })
    }
  })

  it('never emits a canonical pointing elsewhere together with a noindex', () => {
    for (const kind of LEGAL_KINDS) {
      for (const version of ['v1', 'v2', 'v7']) {
        const { canonical, noindex } = legalCrawlDirectives(kind, version)
        const pointsElsewhere = canonical === `/${kind}`
        expect(pointsElsewhere && noindex).toBe(false)
      }
    }
  })
})

describe('the shipped texts', () => {
  // §7.4 bans these words in every string in the product. The legal texts are where a
  // drafter reaches for them hardest, so the ban is asserted rather than trusted.
  // `verified` is deliberately absent from this list: §7.11 requires the privacy policy to
  // disclose that Google returns "whether the email is verified", and §7.4's ban is on
  // assurance *about programmes or contributors*, not on describing what Google sends.
  const BANNED = [
    'vetted',
    'curated',
    'quality-assured',
    'safe to use',
    'ready to use',
    'rest assured',
    "don't worry",
    'we guarantee',
    'we ensure',
    'we make sure',
    'free forever',
    'trusted by',
    'join thousands',
  ]

  it('uses none of §7.4’s banned words', () => {
    for (const version of shippedVersions()) {
      for (const kind of LEGAL_KINDS) {
        const text = readLegalDocument(kind, version).toLowerCase()
        for (const word of BANNED) {
          expect(text, `${kind}-${version}.md contains "${word}"`).not.toContain(word)
        }
      }
    }
  })

  it('carries §7.18’s LAWYER blocks where the outlines put them', () => {
    // privacy §11 carries two; terms §10 and §13 carry one each.
    expect(readLegalDocument('privacy', 'v1').match(/\*\*LAWYER/g)).toHaveLength(2)
    expect(readLegalDocument('terms', 'v1').match(/\*\*LAWYER/g)).toHaveLength(2)
  })
})
