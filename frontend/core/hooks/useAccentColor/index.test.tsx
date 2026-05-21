import { renderHook } from '@testing-library/react'

import { COLOR } from '~/const/colors'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useAccentColor from '~/hooks/useAccentColor'

describe('useAccentColor', () => {
  it('uses the accent CSS-var rainbow token', () => {
    const wrapper = makeStoreWrapper({ dashboard: { themeTokens: { accentColor: '#334455' } } })
    const { result } = renderHook(() => useAccentColor(), { wrapper })

    expect(result.current).toBe(COLOR.CUSTOM)
  })
})
