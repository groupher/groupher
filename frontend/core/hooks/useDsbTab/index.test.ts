import { renderHook } from '@testing-library/react'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'

let mockPathname = '/'

vi.mock('next/navigation', () => {
  return {
    usePathname: () => mockPathname,
    useSearchParams: () => new URLSearchParams(),
    useSelectedLayoutSegments: () => [],
  }
})

describe('useDsbTab', () => {
  it('parses main/sub tabs from pathname', () => {
    mockPathname = '/acme/dashboard/threads/posts'
    const { result } = renderHook(() => useDsbTab())
    expect(result.current.mainTab).toBe('threads')
    expect(result.current.subTab).toBe('posts')

    mockPathname = '/acme/posts'
    const r2 = renderHook(() => useDsbTab()).result
    expect(r2.current.mainTab).toBe(DSB_ROUTE.OVERVIEW)
    expect(r2.current.subTab).toBeNull()
  })
})
