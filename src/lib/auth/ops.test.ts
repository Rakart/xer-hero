import { afterEach, describe, expect, it } from 'vitest'
import { isOperator } from './ops'

const original = process.env.OPS_ALLOWED_USER_IDS

afterEach(() => {
  if (original === undefined) delete process.env.OPS_ALLOWED_USER_IDS
  else process.env.OPS_ALLOWED_USER_IDS = original
})

describe('isOperator — the whole of `/ops` authorisation (§4.7)', () => {
  it('admits a Clerk id named in the env var', () => {
    process.env.OPS_ALLOWED_USER_IDS = 'user_a, user_b'
    expect(isOperator('user_b')).toBe(true)
  })

  it('refuses anyone else', () => {
    process.env.OPS_ALLOWED_USER_IDS = 'user_a'
    expect(isOperator('user_c')).toBe(false)
  })

  it('refuses everyone when the allowlist is empty — the deployed default', () => {
    process.env.OPS_ALLOWED_USER_IDS = ''
    expect(isOperator('user_a')).toBe(false)
  })

  it('refuses a signed-out viewer without consulting the list', () => {
    process.env.OPS_ALLOWED_USER_IDS = 'user_a'
    expect(isOperator(null)).toBe(false)
  })
})
