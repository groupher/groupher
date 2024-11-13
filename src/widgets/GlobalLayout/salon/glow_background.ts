import type { TMetric, TGlowPosition } from '~/spec'

import { GLOW_EFFECTS_DAY, GLOW_EFFECTS_NIGHT } from '~/const/glow_effect'
import THEME from '~/const/theme'
import METRIC from '~/const/metric'

import { fmtOpacity } from '~/fmt'
import useTwBelt from '~/hooks/useTwBelt'
import useMetric from '~/hooks/useMetric'
import useTheme from '~/hooks/useTheme'
import useGlowLight from '~/hooks/useGlowLight'

const getGlowPosition = (metric: TMetric, glowFixed: boolean): TGlowPosition => {
  if (metric === METRIC.HOME) {
    return 'absolute'
  }

  return glowFixed ? 'fixed' : 'absolute'
}

export default () => {
  const { cn } = useTwBelt()

  const metric = useMetric()
  const { theme } = useTheme()

  const { glowType, glowFixed, glowOpacity } = useGlowLight()
  const GLOW_EFFECTS = theme === THEME.LIGHT ? GLOW_EFFECTS_DAY : GLOW_EFFECTS_NIGHT

  const glowPosition = getGlowPosition(metric, glowFixed)
  const isAbsolute = glowPosition === 'absolute'

  return {
    bgStyle: glowType
      ? `
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].LEFT.X} ${GLOW_EFFECTS[glowType].LEFT.Y}, ${GLOW_EFFECTS[glowType].LEFT.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].LEFT.RADIUS}),
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].RIGHT1.X} ${GLOW_EFFECTS[glowType].RIGHT1.Y}, ${GLOW_EFFECTS[glowType].RIGHT1.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].RIGHT1.RADIUS}),
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].MAIN.X} ${GLOW_EFFECTS[glowType].MAIN.Y}, ${GLOW_EFFECTS[glowType].MAIN.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].MAIN.RADIUS}),
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].RIGHT2.X} ${GLOW_EFFECTS[glowType].RIGHT2.Y}, ${GLOW_EFFECTS[glowType].RIGHT2.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].RIGHT1.RADIUS})
    `
      : '',
    wrapper: cn(
      'w-full -z-10',
      isAbsolute ? 'h-2/5 right-0' : 'h-fit',
      `opacity-${fmtOpacity(glowOpacity)}`,
      glowPosition,
    ),
  }
}
