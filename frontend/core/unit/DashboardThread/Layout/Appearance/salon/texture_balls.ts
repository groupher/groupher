import { GLOW_EFFECTS_DAY, GLOW_EFFECTS_NIGHT } from '~/const/glow_effect'
import THEME from '~/const/theme'
import usePageBg from '~/hooks/usePageBg'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

const TEXTURE_GLOW_ALPHA = '82'

const previewGlowColor = (color: string): string => {
  if (!/^#[\dA-Fa-f]{8}$/.test(color)) return color

  return `${color.slice(0, 7)}${TEXTURE_GLOW_ALPHA}`
}

export default function useSalon() {
  const { cn, fill, br, primary } = useTwBelt()
  const { theme } = useTheme()
  const pageBg = usePageBg()

  const GLOW_EFFECTS = theme === THEME.LIGHT ? GLOW_EFFECTS_DAY : GLOW_EFFECTS_NIGHT

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
      const glow = GLOW_EFFECTS[glowType]

      return `
      radial-gradient(circle at 18% 8%, ${previewGlowColor(glow.LEFT.COLOR)} 0, transparent 62%),
      radial-gradient(circle at 72% 8%, ${previewGlowColor(glow.MAIN.COLOR)} 0, transparent 68%),
      radial-gradient(circle at 94% 20%, ${previewGlowColor(glow.RIGHT2.COLOR)} 0, transparent 52%)
    `
    },
    icon: cn('size-4', fill('title')),
  }
}
