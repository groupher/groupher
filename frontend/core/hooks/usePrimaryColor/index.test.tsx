import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import usePrimaryColor from '~/hooks/usePrimaryColor'

describe('usePrimaryColor', () => {
  it('uses the primary CSS-var rainbow token', () => {
    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => usePrimaryColor(), { wrapper })
    expect(result.current).toBe(COLOR.CUSTOM)
  })
})
