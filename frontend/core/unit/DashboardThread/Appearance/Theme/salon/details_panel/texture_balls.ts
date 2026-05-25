import usePageBg from '~/hooks/usePageBg'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { buildTopGlowPreviewBackground, resolveTopGlow } from '~/lib/topGlow'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fill, br, primary, bg, hover, sexyBorder } = useTwBelt()
  const { theme } = useTheme()
  const pageBg = usePageBg()
  const toggleBase = 'h-6 px-4 rounded-full'

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
    wrapper: 'w-full',
    row: 'row align-start wrap justify-start gap-x-4 gap-y-4 w-full',

    textureBall: cn('relative size-full rounded-full overflow-hidden', br('divider')),
    glowLayer: 'absolute left-0 top-0 h-3/4 w-full',
    textureStyle: () => ({
      backgroundColor: pageBg.rawBg,
    }),

    glowStyle: (glowType) => {
      const glow = resolveTopGlow(glowType, theme)

      return buildTopGlowPreviewBackground(glow)
    },
    icon: cn('size-4', fill('title')),
    toggle: cn(
      toggleBase,
      'row-center text-xs transition pointer border mt-1',
      hover('box'),
      br('divider'),
    ),
    dividerRow: cn('relative flex justify-center mt-5', sexyBorder()),
    toggleMask: cn(
      'absolute -top-3 h-6 -ml-4 px-[calc(1rem+2px)] rounded-full pointer-events-none row-center text-xs opacity-100',
      bg('card'),
    ),
    toggleFloating: cn(
      'absolute -top-3 h-6 -ml-4 px-4 rounded-full group row-center text-xs transition pointer border',
      hover('box'),
      br('divider'),
    ),
    toggleText: cn('text-xs', hover('fg')),
  }
}
