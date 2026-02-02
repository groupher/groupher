import { renderHook } from '@testing-library/react'

import METRIC from '~/const/metric'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useViewingThread from '~/hooks/useViewingThread'

let mockPathname = '/'

vi.mock('next/navigation', () => {
  return {
    usePathname: () => mockPathname,
    useSearchParams: () => new URLSearchParams(),
    useSelectedLayoutSegments: () => [],
  }
})

describe('useViewingThread', () => {
  it('resolves thread from pathname, but forces POST on landing', () => {
    mockPathname = '/acme/changelog'

    const a = renderHook(() => useViewingThread(), {
      wrapper: makeStoreWrapper({ metric: METRIC.COMMUNITY }),
    }).result
    expect(a.current).toBe('changelog')

    const b = renderHook(() => useViewingThread(), {
      wrapper: makeStoreWrapper({ metric: METRIC.LANDING }),
    }).result
    expect(b.current).toBe('post')
  })
})
