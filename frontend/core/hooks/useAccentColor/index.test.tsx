import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useAccentColor from '~/hooks/useAccentColor'

describe('useAccentColor', () => {
  it('reads accentColor from theme preset tokens', () => {
    const wrapper = makeStoreWrapper({ dashboard: { themeTokens: { accentColor: COLOR.PURPLE } } })
    const { result } = renderHook(() => useAccentColor(), { wrapper })

    expect(result.current).toBe(COLOR.PURPLE)
  })
})
