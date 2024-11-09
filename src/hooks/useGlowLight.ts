import type { TGlowEffect } from '~/spec'
import { includes } from 'ramda'

import METRIC from '~/const/metric'
import { GLOW_EFFECT_NAME, GLOW_OPACITY } from '~/const/glow_effect'

import useSubStore from '~/hooks/useSubStore'
import useMetric from '~/hooks/useMetric'

export default (): TGlowEffect => {
  const dashboard = useSubStore('dashboard')
  const { wallpaper } = useSubStore('wallpaper')

  const metric = useMetric()

  const { glowType, glowFixed, glowOpacity } = dashboard

  const changeGlowEffect = (glowType: string): void => dashboard.commit({ glowType })

  if (includes(metric, [METRIC.APPLY_COMMUNITY])) {
    return {
      glowType: null,
      glowFixed: false,
      glowOpacity: GLOW_OPACITY.WEEK,
      changeGlowEffect,
    }
  }

  if (metric === METRIC.HOME && !glowType) {
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
