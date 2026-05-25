import useTheme from '~/hooks/useTheme'
import useTopGlow from '~/hooks/useTopGlow'
import useTwBelt from '~/hooks/useTwBelt'
import { buildTopGlowBackground, resolveTopGlow } from '~/lib/topGlow'

const toCssOpacity = (opacity = 100): number => {
  const percent = Number(opacity)

  if (Number.isNaN(percent)) return 1

  return Math.min(Math.max(percent, 0), 100) / 100
}

export default function useSalon() {
  const { cn } = useTwBelt()

  const { theme } = useTheme()

  const { glowType, glowFixed, glowOpacity } = useTopGlow()
  const glow = resolveTopGlow(glowType, theme)

  const glowPosition = glowFixed ? 'fixed' : 'absolute'
  const isAbsolute = glowPosition === 'absolute'

  return {
    bgStyle: buildTopGlowBackground(glow),
    wrapper: cn(
      'pointer-events-none z-0 w-full',
      isAbsolute ? 'absolute top-0 right-0 h-2/5' : 'fixed inset-0 h-screen',
      glowPosition,
    ),
    opacity: toCssOpacity(glowOpacity),
  }
}
