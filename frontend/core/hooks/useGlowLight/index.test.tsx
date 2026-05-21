import { act, renderHook, waitFor } from '@testing-library/react'

import METRIC from '~/const/metric'
import THEME from '~/const/theme'
import { THEME_PRESET } from '~/const/theme_preset'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useGlowLight from '~/hooks/useGlowLight'
import useTheme from '~/hooks/useTheme'

describe('useGlowLight', () => {
  it('disables glow in APPLY_COMMUNITY metric', () => {
    const wrapper = makeStoreWrapper({
      metric: METRIC.APPLY_COMMUNITY,
      dashboard: {
        themeTokens: {
          glowType: 'x',
          glowTypeDark: 'GREY_GREEN',
          glowFixed: true,
          glowOpacity: 65,
          glowOpacityDark: 80,
        },
      },
    })

    const { result } = renderHook(() => useGlowLight(), { wrapper })

    expect(result.current.glowType).toBeNull()
    expect(result.current.glowFixed).toBe(false)
  })

  it('disables glow on landing when wallpaper is not PINK', () => {
    const wrapper = makeStoreWrapper({
      metric: METRIC.LANDING,
      wallpaper: { wallpaper: 'blue', wallpaperType: WALLPAPER_TYPE.GRADIENT },
      dashboard: { themeTokens: { glowType: null, glowTypeDark: null } },
    })

    const { result } = renderHook(() => useGlowLight(), { wrapper })
    expect(result.current.glowType).toBeNull()
  })

  it('ignores stale glow tokens on built-in presets', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        themePreset: THEME_PRESET.CLAUDE,
        themeTokens: {
          glowType: 'ORANGE_PURPLE',
          glowTypeDark: 'GREY_GREEN',
          glowFixed: true,
          glowOpacity: 90,
          glowOpacityDark: 35,
        },
      },
    })

    const { result } = renderHook(() => useGlowLight(), { wrapper })

    expect(result.current.glowType).toBe('')
  })

  it('keeps glow enabled for regular pages without wallpaper', async () => {
    const wrapper = makeStoreWrapper({
      wallpaper: { wallpaper: '', wallpaperType: WALLPAPER_TYPE.GRADIENT },
      dashboard: {
        themePreset: THEME_PRESET.CUSTOM,
        themeTokens: {
          glowType: 'ORANGE_PURPLE',
          glowTypeDark: 'GREY_GREEN',
          glowFixed: true,
          glowOpacity: 90,
          glowOpacityDark: 35,
        },
      },
    })

    const { result } = renderHook(() => ({ glow: useGlowLight(), theme: useTheme() }), { wrapper })

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
