import { buildGlowBackground, resolveGlowEffect } from '~/const/glow_effect'
import useGlowLight from '~/hooks/useGlowLight'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

const toCssOpacity = (opacity = 100): number => {
  const percent = Number(opacity)

  if (Number.isNaN(percent)) return 1

  return Math.min(Math.max(percent, 0), 100) / 100
}

export default function useSalon() {
  const { cn } = useTwBelt()

  const { theme } = useTheme()

  const { glowType, glowFixed, glowOpacity } = useGlowLight()
  const glow = resolveGlowEffect(glowType, theme)

  const glowPosition = glowFixed ? 'fixed' : 'absolute'
  const isAbsolute = glowPosition === 'absolute'

  return {
    bgStyle: buildGlowBackground(glow),
    wrapper: cn(
      'pointer-events-none z-0 w-full',
      isAbsolute ? 'absolute top-0 right-0 h-2/5' : 'fixed inset-0 h-screen',
      glowPosition,
    ),
    opacity: toCssOpacity(glowOpacity),
  }
}
