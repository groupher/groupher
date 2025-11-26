import { includes } from 'ramda'
import { GLOW_EFFECT_NAME, GLOW_OPACITY } from '~/const/glow_effect'

import METRIC from '~/const/metric'
import { GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'
import useDashboard from '~/hooks/useDashboard'
import useMetric from '~/hooks/useMetric'
import useSubStore from '~/hooks/useSubStore'
import type { TGlowEffect } from '~/spec'

export default (): TGlowEffect => {
  const dashboard = useDashboard()
  const { wallpaper } = useSubStore('wallpaper')

  const metric = useMetric()

  const { glowType, glowFixed, glowOpacity } = dashboard

  const changeGlowEffect = (glowType: string): void => dashboard.commit({ glowType })

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
    glowType: wallpaper && glowType,
    glowFixed,
    glowOpacity,
    changeGlowEffect,
  }
}
