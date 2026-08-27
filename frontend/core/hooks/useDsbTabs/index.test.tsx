import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useDsbTabs, { type TDsbTabs } from '~/hooks/useDsbTabs'
import type { TCommunity } from '~/spec'

let mockPathname = '/acme'

describe('useDsbTabs', () => {
  it('builds hrefs and resolves activeTab from layout segments', () => {
    mockPathname = '/acme/third-part/integrations'
    window.history.replaceState(null, '', mockPathname)

    const cfg: TDsbTabs = {
      segment: 'third-part',
      items: [
        { slug: 'integrations', title: 'dsb.third_part.analytics' },
        { slug: 'email', title: 'dsb.third_part.email', segment: 'third-part/email' },
      ],
    }

    const StoreWrapper = makeStoreWrapper({
      community: { slug: 'acme' } satisfies Partial<TCommunity>,
    })
    const Wrapper = StoreWrapper

    const { result } = renderHook(() => useDsbTabs(cfg), { wrapper: Wrapper })

    expect(result.current.activeTab).toBe('integrations')
    expect(result.current.items[0].href).toBe('/acme/third-part/integrations')
    expect(result.current.items[1].href).toBe('/acme/third-part/email')
  })
})
