import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetViewerStore, hasClerkSession, requestViewerState } from './viewer-store'

/**
 * The property under test is the one the whole caching design rests on (§6.13): a
 * signed-out visitor issues **zero** requests, and a signed-in one issues **exactly one**
 * however many components ask.
 */

const originalFetch = globalThis.fetch

function setCookie(value: string) {
  Object.defineProperty(globalThis, 'document', {
    value: { cookie: value },
    configurable: true,
    writable: true,
  })
}

function clearDocument() {
  Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true })
}

const RESPONSE = {
  handle: 'planner-a3f92c',
  notices: { failed: false, removal: false },
  voted: [],
  bookmarked: [],
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  __resetViewerStore()
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => RESPONSE }))
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  clearDocument()
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('hasClerkSession', () => {
  it('is false with no document, which is how it behaves on the server', () => {
    clearDocument()
    expect(hasClerkSession()).toBe(false)
  })

  it('is false for a signed-out visitor, whose `__client_uat` is 0', () => {
    setCookie('__client_uat=0')
    expect(hasClerkSession()).toBe(false)
  })

  it('is false when Clerk has set no cookie at all', () => {
    setCookie('some_other=1')
    expect(hasClerkSession()).toBe(false)
  })

  it('is true for a signed-in visitor, including a suffixed production cookie', () => {
    setCookie('__client_uat=1754700000')
    expect(hasClerkSession()).toBe(true)
    setCookie('a=1; __client_uat_Ab12Cd=1754700000; b=2')
    expect(hasClerkSession()).toBe(true)
  })
})

describe('requestViewerState', () => {
  it('issues zero requests for a signed-out visitor, a crawler or an unfurler', async () => {
    setCookie('__client_uat=0')
    const listener = vi.fn()
    requestViewerState(['a', 'b'], listener)
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it('issues exactly one request however many components register', async () => {
    setCookie('__client_uat=1754700000')
    const header = vi.fn()
    const rows = vi.fn()
    const detail = vi.fn()
    requestViewerState([], header)
    requestViewerState(['id-1', 'id-2'], rows)
    requestViewerState(['id-2', 'id-3'], detail)
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toBe('/api/viewer?p=id-1,id-2,id-3')
    for (const listener of [header, rows, detail]) {
      expect(listener).toHaveBeenCalledWith(RESPONSE)
    }
  })

  it('sends no `p` at all on a static page, which registers no ids', async () => {
    setCookie('__client_uat=1754700000')
    requestViewerState([], vi.fn())
    await settle()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/viewer')
  })

  it('caps the id list at the shelf page size', async () => {
    setCookie('__client_uat=1754700000')
    requestViewerState(
      Array.from({ length: 40 }, (_, index) => `id-${index}`),
      vi.fn(),
    )
    await settle()
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url.slice('/api/viewer?p='.length).split(',')).toHaveLength(25)
  })

  it('serves a later subscriber the settled snapshot without a second request', async () => {
    setCookie('__client_uat=1754700000')
    requestViewerState([], vi.fn())
    await settle()
    const late = vi.fn()
    requestViewerState([], late)
    expect(late).toHaveBeenCalledWith(RESPONSE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('leaves the signed-out render standing when the request fails', async () => {
    setCookie('__client_uat=1754700000')
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const listener = vi.fn()
    requestViewerState([], listener)
    await settle()
    expect(listener).toHaveBeenCalledWith(null)
  })
})
