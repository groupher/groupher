import { renderHook } from '@testing-library/react'

import METRIC from '~/const/metric'
import { THREAD } from '~/const/thread'

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
    expect(a.current).toBe(THREAD.CHANGELOG)

    const b = renderHook(() => useViewingThread(), {
      wrapper: makeStoreWrapper({ metric: METRIC.LANDING }),
    }).result
    expect(b.current).toBe(THREAD.POST)
  })

  it('resolves thread from detail pathname segments', () => {
    mockPathname = '/acme/changelog/42'

    const result = renderHook(() => useViewingThread(), {
      wrapper: makeStoreWrapper({ metric: METRIC.COMMUNITY }),
    }).result

    expect(result.current).toBe(THREAD.CHANGELOG)
  })
})
