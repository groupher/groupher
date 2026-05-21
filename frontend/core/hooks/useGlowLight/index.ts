'use client'

import { includes } from 'ramda'

import { GLOW_EFFECT_NAME } from '~/const/glow_effect'
import METRIC from '~/const/metric'
import { GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'
import useMetric from '~/hooks/useMetric'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/hooks/useThemePreset'
import useWallpaper from '~/hooks/useWallpaper'
import type { TGlowEffect } from '~/spec'

const LANDING_GLOW_OPACITY = 65

export default function useGlowLight(): TGlowEffect {
  const { wallpaper } = useWallpaper()
  const { isLightTheme } = useTheme()
  const { glowType, glowTypeDark, glowFixed, glowOpacity, glowOpacityDark } = useThemePreset()
  const activeGlowType = isLightTheme ? glowType : glowTypeDark
  const activeGlowOpacity = isLightTheme ? glowOpacity : glowOpacityDark

  const metric = useMetric()

  if (
    includes(metric, [METRIC.APPLY_COMMUNITY]) ||
    (metric === METRIC.LANDING && wallpaper !== GRADIENT_WALLPAPER_NAME.PINK)
  ) {
    return {
      glowType: null,
      glowFixed: false,
      glowOpacity: LANDING_GLOW_OPACITY,
    }
  }

  if (metric === METRIC.LANDING && !activeGlowType) {
    return {
      glowType: GLOW_EFFECT_NAME.ORANGE_PURPLE,
      glowFixed: false,
      glowOpacity: LANDING_GLOW_OPACITY,
    }
  }

  return {
    glowType: activeGlowType,
    glowFixed,
    glowOpacity: activeGlowOpacity,
  }
}
