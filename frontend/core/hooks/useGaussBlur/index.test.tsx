import { act, renderHook, waitFor } from '@testing-library/react'

import THEME from '~/const/theme'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import type { TResolvedThemePreset } from '~/spec'

const makeTokens = (lightBlur: number, darkBlur: number): TResolvedThemePreset => ({
  shared: { glowFixed: true },
  light: {
    pageBg: '#ffffff',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#111111',
    accentColor: '#222222',
    textTitle: '#333333',
    textDigest: '#444444',
    cardColor: '#ffffff',
    dividerColor: '#dddddd',
    gaussBlur: lightBlur,
    glowType: '',
    glowOpacity: 100,
  },
  dark: {
    pageBg: '#111111',
    pageBgHue: 0,
    pageBgIntensity: 0,
    primaryColor: '#eeeeee',
    accentColor: '#dddddd',
    textTitle: '#cccccc',
    textDigest: '#bbbbbb',
    cardColor: '#222222',
    dividerColor: '#333333',
    gaussBlur: darkBlur,
    glowType: '',
    glowOpacity: 100,
  },
})

describe('useGaussBlur', () => {
  it('switches blur by theme', async () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        themeTokens: makeTokens(10, 20),
      },
    })
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
