import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useDsbCrumbItems, { type TDsbCrumbNode } from '~/hooks/useDsbCrumbItems'

let mockPathname = '/'

vi.mock('next/navigation', () => {
  return {
    usePathname: () => mockPathname,
    useSearchParams: () => new URLSearchParams(),
    useSelectedLayoutSegments: () => [],
  }
})

describe('useDsbCrumbItems', () => {
  it('builds breadcrumb chain using seg/toSeg', () => {
    mockPathname = '/acme/dashboard/third-part/email'

    const wrapper = makeStoreWrapper({ community: { slug: 'acme' } })
    const root: TDsbCrumbNode = {
      title: '绑定集成',
      seg: 'third-part',
      toSeg: 'integrations',
      children: [{ title: 'Email', seg: 'third-part/email' }],
    }

    const { result } = renderHook(() => useDsbCrumbItems(root), { wrapper })
    expect(result.current).toHaveLength(2)
    expect(result.current[0].path).toBe('/acme/dashboard/integrations')
    expect(result.current[1].path).toBe('')
  })
})
