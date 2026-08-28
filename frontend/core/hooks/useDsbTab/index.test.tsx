import { renderHook } from '@testing-library/react'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
let mockPathname = '/acme'

describe('useDsbTab', () => {
  const render = () => {
    window.history.replaceState(null, '', mockPathname)
    return renderHook(() => useDsbTab())
  }

  it('parses main/sub tabs from pathname', () => {
    mockPathname = '/acme/threads/posts'
    const { result } = render()
    expect(result.current.mainTab).toBe('threads')
    expect(result.current.subTab).toBe('posts')

    mockPathname = '/acme'
    const rOverview = render().result
    expect(rOverview.current.mainTab).toBe(DSB_ROUTE.OVERVIEW)
    expect(rOverview.current.subTab).toBeNull()

    mockPathname = '/acme'
    const r2 = render().result
    expect(r2.current.mainTab).toBe(DSB_ROUTE.OVERVIEW)
    expect(r2.current.subTab).toBeNull()
  })
})
