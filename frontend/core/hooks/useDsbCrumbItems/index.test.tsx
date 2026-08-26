import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useDsbCrumbItems, { type TDsbCrumbNode } from '~/hooks/useDsbCrumbItems'
import { RouteScopeProvider, type TRouteScope } from '~/platform'

let mockPathname = '/acme'
let mockSearch = ''

describe('useDsbCrumbItems', () => {
  it('builds breadcrumb chain using seg/toSeg', () => {
    mockPathname = '/acme/third-part/email'
    const value: TRouteScope = {
      navi: {
        location: {
          pathname: mockPathname,
          search: mockSearch,
          searchParams: new URLSearchParams(mockSearch),
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

    const StoreWrapper = makeStoreWrapper({ community: { slug: 'acme' } })
    const root: TDsbCrumbNode = {
      title: 'dsb.third_part.analytics',
      seg: 'third-part',
      toSeg: 'integrations',
      children: [{ title: 'dsb.third_part.email', seg: 'third-part/email' }],
    }

    const Wrapped = ({ children }: { children: ReactNode }) => (
      <RouteScopeProvider value={value}>
        <StoreWrapper>{children}</StoreWrapper>
      </RouteScopeProvider>
    )

    const { result } = renderHook(() => useDsbCrumbItems(root), { wrapper: Wrapped })
    expect(result.current).toHaveLength(2)
    expect(result.current[0].path).toBe('/acme/integrations')
    expect(result.current[1].path).toBe('')
  })
})
