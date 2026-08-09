import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeCp1252, decodeCp1252WithReport } from './decode'

const corpus = (name: string): Uint8Array =>
  new Uint8Array(
    readFileSync(new URL(`../../../fixtures/synthetic/corpus/${name}`, import.meta.url)),
  )

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values)

describe('decodeCp1252', () => {
  it('is identity over ASCII', () => {
    const ascii = 'ERMHDR\t6.0\t2026-08-07\tProject\tadmin'
    expect(decodeCp1252(new Uint8Array([...ascii].map((c) => c.charCodeAt(0))))).toBe(ascii)
  })

  it('maps the 0x80-0x9F block, which is the part of CP1252 that is not Latin-1', () => {
    expect(decodeCp1252(bytes(0x80, 0x93, 0x94, 0x96, 0x97, 0x99, 0x8c))).toBe('€“”–—™Œ')
  })

  it('maps Latin-1 high bytes, including the currency symbols seen in CURRTYPE', () => {
    expect(decodeCp1252(bytes(0xa3, 0xa5, 0xd8, 0xe7))).toBe('£¥Øç')
  })

  it('never throws on the five bytes CP1252 leaves undefined, and counts them', () => {
    const report = decodeCp1252WithReport(bytes(0x41, 0x81, 0x8d, 0x8f, 0x90, 0x9d, 0x42))
    // The WHATWG mapping keeps the byte recoverable rather than replacing it (§2.3).
    expect(report.text).toBe(`A${String.fromCharCode(0x81, 0x8d, 0x8f, 0x90, 0x9d)}B`)
    expect(report.undefinedByteCount).toBe(5)
  })

  it('decodes enc-cp1252-currency to the strings the golden names', () => {
    const text = decodeCp1252(corpus('enc-cp1252-currency.xer'))
    expect(text).toContain('Cast Base Slab — north end')
    expect(text).toContain('Install “Type A” Switchgear')
    expect(text).toContain('Survey Façade — Ø450 duct')
    // The pound and yen symbols live in CURRTYPE on this fixture.
    expect(text).toContain('£')
    expect(text).toContain('¥')
  })

  it('reports the 0x81 bytes and the UTF-8 runs in enc-mojibake-0x81 without failing', () => {
    const report = decodeCp1252WithReport(corpus('enc-mojibake-0x81.xer'))
    // §2.3: a strict decoder throws here, and on the real Fixture B 31,485 times.
    expect(report.undefinedByteCount).toBe(2)
    expect(report.utf8SequenceCount).toBeGreaterThan(0)
    expect(report.text.includes(String.fromCharCode(0x81))).toBe(true)
  })

  it('finds no UTF-8 runs in a file whose high bytes are honestly CP1252', () => {
    expect(decodeCp1252WithReport(corpus('enc-cp1252-currency.xer')).utf8SequenceCount).toBe(0)
  })

  it('decodes 397,781 NUL bytes without complaint - the guard is a byte fact, not a decode', () => {
    const zeroed = corpus('enc-zeroed-file.xer')
    const text = decodeCp1252(zeroed)
    expect(text).toHaveLength(zeroed.length)
    expect(text.charCodeAt(0)).toBe(0)
  })

  it('leaves a pure-ASCII export with nothing to report', () => {
    const report = decodeCp1252WithReport(corpus('ver-60-fieldset.xer'))
    expect(report.highByteCount).toBe(0)
    expect(report.undefinedByteCount).toBe(0)
    expect(report.utf8SequenceCount).toBe(0)
  })
})
