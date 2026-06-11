import { act, renderHook, waitFor } from '@testing-library/react'

import METRIC from '~/const/metric'
import THEME from '~/const/theme'
import { THEME_PRESET } from '~/const/theme_preset'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useTheme from '~/hooks/useTheme'
import useTopGlow from '~/hooks/useTopGlow'
import type { TResolvedThemePreset } from '~/spec'

const makeTokens = ({
  lightGlowType = '',
  darkGlowType = '',
  lightGlowOpacity = 100,
  darkGlowOpacity = 100,
}: {
  lightGlowType?: string | null
  darkGlowType?: string | null
  lightGlowOpacity?: number
  darkGlowOpacity?: number
}): TResolvedThemePreset => ({
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
    gaussBlur: 100,
    glowType: lightGlowType as string,
    glowOpacity: lightGlowOpacity,
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
    gaussBlur: 100,
    glowType: darkGlowType as string,
    glowOpacity: darkGlowOpacity,
  },
})

describe('useTopGlow', () => {
  it('disables glow in APPLY_COMMUNITY metric', () => {
    const wrapper = makeStoreWrapper({
      metric: METRIC.APPLY_COMMUNITY,
      dashboard: {
        themeTokens: makeTokens({
          lightGlowType: 'x',
          darkGlowType: 'GREY_GREEN',
          lightGlowOpacity: 65,
          darkGlowOpacity: 80,
        }),
      },
    })

    const { result } = renderHook(() => useTopGlow(), { wrapper })

    expect(result.current.glowType).toBeNull()
    expect(result.current.glowFixed).toBe(false)
  })

  it('disables glow on landing when wallpaper is not AMBER_MAUVE', () => {
    const wrapper = makeStoreWrapper({
      metric: METRIC.LANDING,
      wallpaper: { light: { source: 'sky_mauve_blue', type: WALLPAPER_TYPE.GRADIENT } },
      dashboard: {
        themeTokens: makeTokens({ lightGlowType: null, darkGlowType: null }),
      },
    })

    const { result } = renderHook(() => useTopGlow(), { wrapper })
    expect(result.current.glowType).toBeNull()
  })

  it('ignores stale glow tokens on built-in presets', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        themePreset: THEME_PRESET.CLAUDE,
        themeTokens: makeTokens({
          lightGlowType: 'ORANGE_PURPLE',
          darkGlowType: 'GREY_GREEN',
          lightGlowOpacity: 90,
          darkGlowOpacity: 35,
        }),
      },
    })

    const { result } = renderHook(() => useTopGlow(), { wrapper })

    expect(result.current.glowType).toBe('')
  })

  it('keeps glow enabled for regular pages without wallpaper', async () => {
    const wrapper = makeStoreWrapper({
      wallpaper: { light: { source: '', type: WALLPAPER_TYPE.GRADIENT } },
      dashboard: {
        themePreset: THEME_PRESET.CUSTOM,
        themeTokens: makeTokens({
          lightGlowType: 'ORANGE_PURPLE',
          darkGlowType: 'GREY_GREEN',
          lightGlowOpacity: 90,
          darkGlowOpacity: 35,
        }),
      },
    })

    const { result } = renderHook(() => ({ glow: useTopGlow(), theme: useTheme() }), { wrapper })

    expect(result.current.glow.glowType).toBe('ORANGE_PURPLE')
    expect(result.current.glow.glowFixed).toBe(true)
    expect(result.current.glow.glowOpacity).toBe(90)

    act(() => result.current.theme.toggle())

    await waitFor(() => {
      expect(result.current.theme.theme).toBe(THEME.DARK)
    })
    await waitFor(() => {
      expect(result.current.glow.glowType).toBe('GREY_GREEN')
      expect(result.current.glow.glowOpacity).toBe(35)
    })
  })
})
