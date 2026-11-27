import useTwBelt from '~/hooks/useTwBelt'
import { buildTopGlowBackground, resolveTopGlow } from '~/lib/topGlow'

export { cn } from '~/css'

export default function useSalon({ visible, compact = false }) {
  const { cn, bg, br, fill, zIndex, hover, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'relative column mx-auto h-auto rounded-md border',
      compact ? 'min-h-0' : 'min-h-72',
      shadow('modal'),
      br('divider'),
      bg('modal.bg'),
    ),
    mask: cn(
      'fixed overflow-auto top-0 right-0 bottom-0 left-0 w-full h-full max-w-none max-h-none m-0 p-0 border-none transition-opacity duration-200',
      bg('modal.mask'),
      zIndex('modalOverlay', visible),
    ),
    backdrop: 'absolute inset-0 size-full border-none bg-transparent',
    children: cn(compact ? 'min-h-0' : 'min-h-72', 'h-auto', 'grow', 'overflow-y-auto'),
    //
    closeBox: cn('align-both size-7 absolute top-3.5 right-4 z-10', hover('bg')),
    closeIcon: cn('size-5', fill('digest'), hover('icon'), zIndex('modalCloseBtn')),
    //
    glowLight: 'absolute w-full h-3/5 opacity-65 top-0 left-0 rotate-y-180 pointer-events-none',
    glowLightStyle: (glowType, theme) => {
      if (!glowType) return {}

      const glow = resolveTopGlow(glowType, theme)

      if (!glow) return {}

      return {
        background: buildTopGlowBackground(glow),
      }
    },
  }
}
