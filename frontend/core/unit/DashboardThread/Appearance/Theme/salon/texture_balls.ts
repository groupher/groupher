import { buildGlowPreviewBackground, resolveGlowEffect } from '~/const/glow_effect'
import usePageBg from '~/hooks/usePageBg'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fill, br, primary } = useTwBelt()
  const { theme } = useTheme()
  const pageBg = usePageBg()

  return {
    block: cn(
      'relative align-both size-9 rounded-full border pointer overflow-visible',
      'opacity-80 saturate-90 transition-all duration-150 hover:-translate-y-0.5 hover:opacity-100 hover:saturate-100',
      br('divider'),
    ),
    blockActive: cn(
      'opacity-100 saturate-100',
      primary('borderSoft'),
      `hover:${primary('border')}`,
      'after:absolute after:-inset-1 after:rounded-full after:border after:border-current after:opacity-25',
      primary('fg'),
    ),
    row: 'row-center wrap justify-start gap-x-4 gap-y-4 w-full',

    textureBall: cn('relative size-full rounded-full overflow-hidden', br('divider')),
    glowLayer: 'absolute left-0 top-0 h-3/4 w-full',
    textureStyle: () => ({
      backgroundColor: pageBg.rawBg,
    }),

    glowStyle: (glowType) => {
      const glow = resolveGlowEffect(glowType, theme)

      return buildGlowPreviewBackground(glow)
    },
    icon: cn('size-4', fill('title')),
  }
}
