import { describe, expect, test } from 'vitest'
import { mergePressed } from '@/lib/auth/viewer-state'

/**
 * The late-pressed rule (§6.13 rule 4) is written twice, and this test is the reason that is
 * safe.
 *
 * `mergePressed` in `lib/auth` states the rule over a whole snapshot. `useToggleControl` in
 * this directory states it over **one** control, as `local ?? known ?? false`, because a row
 * control owns exactly one id and threading a Map through it per render would be an
 * allocation and a worse read for no behaviour.
 *
 * Two spellings of one rule drift the moment one of them is edited. So this asserts they
 * agree over the complete truth table — and if the row's expression is ever changed, the
 * failure lands here rather than as a viewer watching their own click undo itself.
 */

const ID = 'de6cd6b0-0000-4000-8000-000000000001'

/** The row control's expression, extracted verbatim. */
function rowControl(local: boolean | null, known: boolean | null): boolean {
  return local ?? known ?? false
}

describe('the row control and mergePressed state one rule', () => {
  const locals: (boolean | null)[] = [null, true, false]
  const knowns: (boolean | null)[] = [null, true, false]

  for (const local of locals) {
    for (const known of knowns) {
      test(`local=${local} snapshot=${known}`, () => {
        // `known` is null before the snapshot lands, which `mergePressed` models as an id
        // absent from every list — the endpoint returns only the pressed ones.
        const snapshot = known === true ? [ID] : []
        const dirty = local === null ? new Map<string, boolean>() : new Map([[ID, local]])
        const merged = mergePressed(snapshot, dirty, [ID]).get(ID)

        // Before the snapshot arrives the row draws unpressed, which is also what
        // `mergePressed` yields for an id the snapshot does not list.
        expect(rowControl(local, known)).toBe(merged)
      })
    }
  }

  test('a late snapshot never overwrites a press the viewer has already made', () => {
    // The failure this rule exists to prevent: snapshot taken before the click, arriving
    // after it. Naively applied it unsets the control, the viewer clicks again, and the
    // second click toggles the true state off.
    expect(rowControl(true, false)).toBe(true)
    expect(mergePressed([], new Map([[ID, true]]), [ID]).get(ID)).toBe(true)
  })

  test('a late snapshot never overwrites an un-press either', () => {
    expect(rowControl(false, true)).toBe(false)
    expect(mergePressed([ID], new Map([[ID, false]]), [ID]).get(ID)).toBe(false)
  })
})
