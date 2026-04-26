import { renderHook } from '@testing-library/react'

import { DEFAULT_ENABLE } from '~/const/dashboard'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useEnable from '~/hooks/useEnable'

describe('useEnable', () => {
  it('reads enable config from dashboard store', () => {
    const wrapper = makeStoreWrapper({ dashboard: { enable: { ...DEFAULT_ENABLE, doc: false } } })
    const { result } = renderHook(() => useEnable(), { wrapper })
    expect(result.current.post).toBe(true)
    expect(result.current.doc).toBe(false)
  })
})
