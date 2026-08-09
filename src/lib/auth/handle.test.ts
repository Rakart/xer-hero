import { describe, expect, it } from 'vitest'
import { handleProblem, mintHandle, uniqueHandle } from './handle'

describe('handleProblem', () => {
  it('accepts an ordinary Handle', () => {
    expect(handleProblem('planner-a3f92c')).toBeNull()
  })

  it('rejects one that normalises away to nothing', () => {
    expect(handleProblem('  !!  ')).toMatch(/at least/)
  })

  it('rejects one past the column budget rather than truncating it silently', () => {
    expect(handleProblem('a'.repeat(40))).toMatch(/at most/)
  })
})

describe('mintHandle', () => {
  it('is `planner-` plus six hex characters (§6.12)', () => {
    expect(mintHandle(new Uint8Array([0x0a, 0x1b, 0x2c, 0x3d, 0x4e, 0x5f]))).toBe('planner-abcdef')
  })

  it('is that shape whatever the bytes are', () => {
    expect(mintHandle()).toMatch(/^planner-[0-9a-f]{6}$/)
  })
})

describe('uniqueHandle', () => {
  it('takes the first candidate nothing has claimed', async () => {
    const handle = await uniqueHandle(
      async () => false,
      () => 'planner-aaaaaa',
    )
    expect(handle).toBe('planner-aaaaaa')
  })

  it('regenerates on collision against live and retired Handles alike', async () => {
    const claimed = new Set(['planner-aaaaaa', 'planner-bbbbbb'])
    const queue = ['planner-aaaaaa', 'planner-bbbbbb', 'planner-cccccc']
    let n = 0
    const handle = await uniqueHandle(
      async (candidate) => claimed.has(candidate),
      () => queue[n++] ?? 'planner-zzzzzz',
    )
    expect(handle).toBe('planner-cccccc')
  })

  it('gives up rather than looping forever when every Handle is claimed', async () => {
    await expect(
      uniqueHandle(
        async () => true,
        () => 'planner-aaaaaa',
      ),
    ).rejects.toThrow(/free Handle/)
  })
})
