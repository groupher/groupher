import { renderHook } from '@testing-library/react'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useNow from '~/hooks/useNow'

describe('useNow', () => {
  it('reads now from dashboard store', () => {
    const wrapper = makeStoreWrapper({ now: 123 })
    const { result } = renderHook(() => useNow(), { wrapper })
    expect(result.current).toBe(123)
  })
})
