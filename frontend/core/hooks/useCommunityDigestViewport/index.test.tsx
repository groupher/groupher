import { act, renderHook, waitFor } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useCommunityDigestViewport from '~/hooks/useCommunityDigestViewport'

describe('useCommunityDigestViewport', () => {
  it('toggles inView via community store commit', async () => {
    const wrapper = makeStoreWrapper({ community: { slug: 'acme' } })
    const { result } = renderHook(() => useCommunityDigestViewport(), { wrapper })

    expect(result.current.inView).toBe(true)
    act(() => result.current.leaveView())

    await waitFor(() => {
      expect(result.current.inView).toBe(false)
    })

    act(() => result.current.enterView())
    await waitFor(() => {
      expect(result.current.inView).toBe(true)
    })
  })
})
