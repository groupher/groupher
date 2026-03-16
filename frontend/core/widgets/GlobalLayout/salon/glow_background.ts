import { GLOW_EFFECTS_DAY, GLOW_EFFECTS_NIGHT } from '~/const/glow_effect'
import THEME from '~/const/theme'
import { fmtOpacity } from '~/fmt'
import useGlowLight from '~/hooks/useGlowLight'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  const { theme } = useTheme()

  const { glowType, glowFixed, glowOpacity } = useGlowLight()
  const GLOW_EFFECTS = theme === THEME.LIGHT ? GLOW_EFFECTS_DAY : GLOW_EFFECTS_NIGHT

  const glow = glowType ? GLOW_EFFECTS[glowType] : null

  const glowPosition = glowFixed ? 'fixed' : 'absolute'
  const isAbsolute = glowPosition === 'absolute'

  return {
    bgStyle: glow
      ? `
      radial-gradient(circle at ${glow.LEFT.X} ${glow.LEFT.Y}, ${glow.LEFT.COLOR} 0, transparent ${glow.LEFT.RADIUS}),
      radial-gradient(circle at ${glow.RIGHT1.X} ${glow.RIGHT1.Y}, ${glow.RIGHT1.COLOR} 0, transparent ${glow.RIGHT1.RADIUS}),
      radial-gradient(circle at ${glow.MAIN.X} ${glow.MAIN.Y}, ${glow.MAIN.COLOR} 0, transparent ${glow.MAIN.RADIUS}),
      radial-gradient(circle at ${glow.RIGHT2.X} ${glow.RIGHT2.Y}, ${glow.RIGHT2.COLOR} 0, transparent ${glow.RIGHT1.RADIUS})
    `
      : '',
    wrapper: cn(
      'w-full -z-10 pointer-events-none',
      isAbsolute ? 'h-2/5 right-0' : 'h-fit',
      `opacity-${fmtOpacity(glowOpacity)}`,
      glowPosition,
    ),
  }
}
