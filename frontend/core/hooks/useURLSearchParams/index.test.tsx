import { renderHook } from '@testing-library/react'

import useURLSearchParams, { ALLOWED_QUERY_KEYS } from '~/hooks/useURLSearchParams'

let mockSearchParams: URLSearchParams | null = null

vi.mock('next/navigation', () => {
  return {
    useSearchParams: () => mockSearchParams,
  }
})

describe('useURLSearchParams', () => {
  it('filters search params by default allowlist', () => {
    mockSearchParams = new URLSearchParams('mode=demo&foo=bar&other=1')

    const { result } = renderHook(() => useURLSearchParams())

    expect(result.current).toBe('?mode=demo&other=1')
  })

  it('supports custom allowlist', () => {
    mockSearchParams = new URLSearchParams('mode=demo&foo=bar&other=1')

    const { result } = renderHook(() => useURLSearchParams(['foo']))

    expect(result.current).toBe('?foo=bar')
  })

  it('returns empty string when nothing is matched', () => {
    mockSearchParams = new URLSearchParams('foo=bar')

    const { result } = renderHook(() => useURLSearchParams(ALLOWED_QUERY_KEYS))

    expect(result.current).toBe('')
  })
})
