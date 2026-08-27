import { renderHook } from '@testing-library/react'

import useURLSearchParams from '~/hooks/useURLSearchParams'

describe('useURLSearchParams', () => {
  it('returns memoized URLSearchParams for the current location', () => {
    window.history.replaceState(null, '', '/?mode=demo&foo=bar&other=1')

    const { result } = renderHook(() => useURLSearchParams())

    expect(result.current).toEqual(new URLSearchParams('mode=demo&foo=bar&other=1'))
  })

  it('returns an empty URLSearchParams when the location has no query', () => {
    window.history.replaceState(null, '', '/')

    const { result } = renderHook(() => useURLSearchParams())

    expect(result.current.toString()).toBe('')
  })
})
