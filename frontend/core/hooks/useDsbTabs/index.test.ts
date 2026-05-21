import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useDsbTabs, { type TDsbTabs } from '~/hooks/useDsbTabs'
import type { TCommunity } from '~/spec'

let mockSegments: string[] = []

vi.mock('next/navigation', () => {
  return {
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useSelectedLayoutSegments: () => mockSegments,
  }
})

describe('useDsbTabs', () => {
  it('builds hrefs and resolves activeTab from layout segments', () => {
    mockSegments = ['integrations']

    const cfg: TDsbTabs = {
      segment: 'third-part',
      items: [
        { slug: 'integrations', title: 'dsb.third_part.analytics' },
        { slug: 'email', title: 'dsb.third_part.email', segment: 'third-part/email' },
      ],
    }

    const wrapper = makeStoreWrapper({ community: { slug: 'acme' } satisfies Partial<TCommunity> })
    const { result } = renderHook(() => useDsbTabs(cfg), { wrapper })

    expect(result.current.activeTab).toBe('integrations')
    expect(result.current.items[0].href).toBe('/acme/dashboard/third-part/integrations')
    expect(result.current.items[1].href).toBe('/acme/dashboard/third-part/third-part/email')
  })
})
