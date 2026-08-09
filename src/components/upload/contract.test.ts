import { describe, expect, it } from 'vitest'
import { SECTOR_CODES } from '@/lib/contracts/domain'
import { type MetadataValues, validateMetadata } from './contract'

const filled: MetadataValues = {
  title: 'Riverside depot — stage 2',
  description: '',
  sector: '',
  changeNote: '',
  handle: 'planner-a3f92c',
  rights: true,
}

const check = (
  values: Partial<MetadataValues>,
  rules = { requireChangeNote: false, requireHandle: false },
) => validateMetadata({ ...filled, ...values }, rules, SECTOR_CODES)

describe('validateMetadata — the five fields of §5.4', () => {
  it('passes a title and a ticked checkbox with nothing else filled in', () => {
    expect(check({})).toEqual({})
  })

  it('requires a title despite the prefill, or the shelf fills with rows named C1042', () => {
    expect(check({ title: '   ' }).title).toMatch(/required/)
  })

  it('requires the rights checkbox — it is the per-revision assertion (§7.2)', () => {
    expect(check({ rights: false }).rights).toBeTruthy()
  })

  it('leaves sector optional, so an upload is never blocked on a dropdown', () => {
    expect(check({ sector: '' }).sector).toBeUndefined()
    expect(check({ sector: 'rail' }).sector).toBeUndefined()
  })

  it('refuses a sector that is not one of the eight seeded codes', () => {
    expect(check({ sector: 'spaceports' }).sector).toBeTruthy()
  })

  it("requires change_note on a fork's rev 1 and not otherwise", () => {
    expect(
      check({ changeNote: '' }, { requireChangeNote: true, requireHandle: false }).changeNote,
    ).toBeTruthy()
    expect(check({ changeNote: '' }).changeNote).toBeUndefined()
  })

  it('requires the Handle at first upload, like the title (§6.12)', () => {
    expect(
      check({ handle: '' }, { requireChangeNote: false, requireHandle: true }).handle,
    ).toBeTruthy()
    expect(check({ handle: '' }).handle).toBeUndefined()
  })

  it('holds every field to a column budget', () => {
    expect(check({ title: 'x'.repeat(400) }).title).toMatch(/Too long/)
    expect(check({ description: 'x'.repeat(5000) }).description).toMatch(/Too long/)
  })
})
