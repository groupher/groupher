import { renderHook } from '@testing-library/react'

import { THEME_MODE } from '~/const/theme'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useThemeLoop from '~/hooks/useThemeLoop'

describe('useThemeLoop', () => {
  it('returns next mode based on initial loop', () => {
    const wrapper = makeStoreWrapper()
    const { result } = renderHook(() => useThemeLoop(), { wrapper })
    expect(result.current.getNextThemeMode()).toBe(THEME_MODE.DARK)
    expect(result.current.getAriaLabel()).toBe(`${THEME_MODE.SYSTEM} mode`)
  })
})
