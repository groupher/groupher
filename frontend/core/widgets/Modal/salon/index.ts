import { GLOW_EFFECTS_DAY, GLOW_EFFECTS_NIGHT } from '~/const/glow_effect'
import THEME from '~/const/theme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ visible }) {
  const { cn, bg, br, zIndex, hover, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'relative column mx-auto h-auto rounded-md min-h-72 border',
      shadow('modal'),
      br('divider'),
      bg('modal.bg'),
    ),
    mask: cn(
      'fixed overflow-auto top-0 right-0 bottom-0 left-0 transition-opacity	duration-200',
      bg('modal.mask'),
      zIndex('modalOverlay', visible),
    ),
    children: cn('min-h-72 h-auto', 'grow', 'overflow-y-auto', 'min-h-0'),
    //
    closeBox: cn('align-both size-7 absolute top-3.5 right-4 z-10', hover('bg')),
    closeIcon: cn('size-5', hover('icon'), zIndex('modalCloseBtn')),
    //
    glowLight: 'absolute w-full h-3/5 opacity-65 top-0 left-0 rotate-y-180 pointer-events-none',
    glowLightStyle: (glowType, theme) => {
      if (!glowType) return {}

      const GLOW_EFFECTS = theme === THEME.LIGHT ? GLOW_EFFECTS_DAY : GLOW_EFFECTS_NIGHT

      return {
        background: `radial-gradient(circle at ${GLOW_EFFECTS[glowType].LEFT.X} ${GLOW_EFFECTS[glowType].LEFT.Y}, ${GLOW_EFFECTS[glowType].LEFT.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].LEFT.RADIUS}),
    radial-gradient(circle at ${GLOW_EFFECTS[glowType].RIGHT1.X} ${GLOW_EFFECTS[glowType].RIGHT1.Y}, ${GLOW_EFFECTS[glowType].RIGHT1.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].RIGHT1.RADIUS}),
    radial-gradient(circle at ${GLOW_EFFECTS[glowType].MAIN.X} ${GLOW_EFFECTS[glowType].MAIN.Y}, ${GLOW_EFFECTS[glowType].MAIN.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].MAIN.RADIUS}),
    radial-gradient(circle at ${GLOW_EFFECTS[glowType].RIGHT2.X} ${GLOW_EFFECTS[glowType].RIGHT2.Y}, ${GLOW_EFFECTS[glowType].RIGHT2.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].RIGHT1.RADIUS})
  `,
      }
    },
  }
}
