import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useDsbCrumbItems, { type TDsbCrumbNode } from '~/hooks/useDsbCrumbItems'

describe('useDsbCrumbItems', () => {
  it('builds breadcrumb chain using seg/toSeg', () => {
    window.history.replaceState(null, '', '/acme/third-part/email')

    const StoreWrapper = makeStoreWrapper({ community: { slug: 'acme' } })
    const root: TDsbCrumbNode = {
      title: 'dsb.third_part.analytics',
      seg: 'third-part',
      toSeg: 'integrations',
      children: [{ title: 'dsb.third_part.email', seg: 'third-part/email' }],
    }

    const Wrapped = StoreWrapper

    const { result } = renderHook(() => useDsbCrumbItems(root), { wrapper: Wrapped })
    expect(result.current).toHaveLength(2)
    expect(result.current[0].path).toBe('/acme/integrations')
    expect(result.current[1].path).toBe('')
  })
})
