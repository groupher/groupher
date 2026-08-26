import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useDsbTabs, { type TDsbTabs } from '~/hooks/useDsbTabs'
import { RouteScopeProvider, type TRouteScope } from '~/platform'
import type { TCommunity } from '~/spec'

let mockPathname = '/acme'
let mockSearch = ''

describe('useDsbTabs', () => {
  it('builds hrefs and resolves activeTab from layout segments', () => {
    mockPathname = '/acme/third-part/integrations'

    const cfg: TDsbTabs = {
      segment: 'third-part',
      items: [
        { slug: 'integrations', title: 'dsb.third_part.analytics' },
        { slug: 'email', title: 'dsb.third_part.email', segment: 'third-part/email' },
      ],
    }

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

    const StoreWrapper = makeStoreWrapper({
      community: { slug: 'acme' } satisfies Partial<TCommunity>,
    })
    const Wrapper = ({ children }: { children: ReactNode }) => {
      return (
        <RouteScopeProvider value={value}>
          <StoreWrapper>{children}</StoreWrapper>
        </RouteScopeProvider>
      )
    }

    const { result } = renderHook(() => useDsbTabs(cfg), { wrapper: Wrapper })

    expect(result.current.activeTab).toBe('integrations')
    expect(result.current.items[0].href).toBe('/acme/third-part/integrations')
    expect(result.current.items[1].href).toBe('/acme/third-part/email')
  })
})
