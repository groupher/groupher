import { act, renderHook, waitFor } from '@testing-library/react'

import THEME from '~/const/theme'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'

describe('useGaussBlur', () => {
  it('switches blur by theme', async () => {
    const wrapper = makeStoreWrapper({ dashboard: { gaussBlur: 10, gaussBlurDark: 20 } })
    const { result } = renderHook(() => ({ blur: useGaussBlur(), theme: useTheme() }), { wrapper })

    expect(result.current.blur).toBe(10)

    act(() => result.current.theme.toggle())

    await waitFor(() => {
      expect(result.current.theme.theme).toBe(THEME.DARK)
    })
    await waitFor(() => {
      expect(result.current.blur).toBe(20)
    })
  })
})
