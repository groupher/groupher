import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import { RouteScopeProvider, type TRouteScope } from '~/platform'

let mockPathname = '/acme'
let mockSearch = ''

describe('useDsbTab', () => {
  const render = () => {
    const searchParams = new URLSearchParams(mockSearch)
    const value: TRouteScope = {
      navi: {
        location: {
          pathname: mockPathname,
          search: mockSearch,
          searchParams,
        },
        to: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(async () => {}),
        isActive: vi.fn(() => false),
        dsbRootSegment: 'dash',
      },
    }

    return renderHook(() => useDsbTab(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <RouteScopeProvider value={value}>{children}</RouteScopeProvider>
      ),
    })
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
