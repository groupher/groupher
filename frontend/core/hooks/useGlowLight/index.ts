import { includes } from 'ramda'

import { GLOW_EFFECT_NAME, GLOW_OPACITY } from '~/const/glow_effect'
import METRIC from '~/const/metric'
import { GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'
import useMetric from '~/hooks/useMetric'
import useWallpaper from '~/hooks/useWallpaper'
import type { TGlowEffect } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

export default function useGlowLight(): TGlowEffect {
  const dsb$ = useDashboard()
  const { wallpaper } = useWallpaper()

  const metric = useMetric()

  const { glowType, glowFixed, glowOpacity } = dsb$

  const changeGlowEffect = (glowType: string): void => dsb$.commit({ glowType })

  if (
    includes(metric, [METRIC.APPLY_COMMUNITY]) ||
    (metric === METRIC.LANDING && wallpaper !== GRADIENT_WALLPAPER_NAME.PINK)
  ) {
    return {
      glowType: null,
      glowFixed: false,
      glowOpacity: GLOW_OPACITY.WEEK,
      changeGlowEffect,
    }
  }

  if (metric === METRIC.LANDING && !glowType) {
    return {
      glowType: GLOW_EFFECT_NAME.ORANGE_PURPLE,
      glowFixed: false,
      // glowOpacity: isLightTheme ? GLOW_OPACITY.WEEK : GLOW_OPACITY.NORMAL,
      glowOpacity: GLOW_OPACITY.WEEK,
      changeGlowEffect,
    }
  }

  return {
    glowType,
    glowFixed,
    glowOpacity,
    changeGlowEffect,
  }
}
