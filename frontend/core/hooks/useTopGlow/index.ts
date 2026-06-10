'use client'

import { includes } from 'ramda'

import METRIC from '~/const/metric'
import { THEME_PRESET } from '~/const/theme_preset'
import { TOP_GLOW } from '~/const/top_glow'
import { GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'
import useMetric from '~/hooks/useMetric'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/hooks/useThemePreset'
import type { TTopGlow } from '~/spec'
import { pickWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

const LANDING_GLOW_OPACITY = 65

export default function useTopGlow(): TTopGlow {
  const wallpaper = useWallpaperDomain()
  const { isLightTheme } = useTheme()
  const { source } = pickWallpaperThemeState(wallpaper, !isLightTheme)
  const { themePreset, glowType, glowTypeDark, glowFixed, glowOpacity, glowOpacityDark } =
    useThemePreset()
  const activeGlowType = isLightTheme ? glowType : glowTypeDark
  const activeGlowOpacity = isLightTheme ? glowOpacity : glowOpacityDark

  const metric = useMetric()

  if (
    includes(metric, [METRIC.APPLY_COMMUNITY]) ||
    (metric === METRIC.LANDING && source !== GRADIENT_WALLPAPER_NAME.AMBER_MAUVE)
  ) {
    return {
      glowType: null,
      glowFixed: false,
      glowOpacity: LANDING_GLOW_OPACITY,
    }
  }

  if (metric === METRIC.LANDING && !activeGlowType) {
    return {
      glowType: TOP_GLOW.ORANGE_PURPLE,
      glowFixed: false,
      glowOpacity: LANDING_GLOW_OPACITY,
    }
  }

  if (themePreset !== THEME_PRESET.CUSTOM) {
    return {
      glowType: '',
      glowFixed,
      glowOpacity: activeGlowOpacity,
    }
  }

  return {
    glowType: activeGlowType,
    glowFixed,
    glowOpacity: activeGlowOpacity,
  }
}
