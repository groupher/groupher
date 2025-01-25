import { GLOW_EFFECTS_DAY, GLOW_EFFECTS_NIGHT } from '~/const/glow_effect'
import THEME from '~/const/theme'

import useTheme from '~/hooks/useTheme'

import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill } = useTwBelt()
  const base = useBase()
  const { theme } = useTheme()

  const GLOW_EFFECTS = theme === THEME.LIGHT ? GLOW_EFFECTS_DAY : GLOW_EFFECTS_NIGHT

  return {
    wrapper: cn(''),
    block: cn(base.blockBase, 'h-60 saturate-100'),
    blockActive: cn(base.blockBaseActive),
    row: 'row-center wrap gap-x-5 gap-y-6 w-full',

    bgWrapper: 'absolute w-full h-full top-0 left-0',

    bgStyle2: (glowType) => {
      return `
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].LEFT.X} ${GLOW_EFFECTS[glowType].LEFT.Y}, ${GLOW_EFFECTS[glowType].LEFT.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].LEFT.RADIUS}),
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].RIGHT1.X} ${GLOW_EFFECTS[glowType].RIGHT1.Y}, ${GLOW_EFFECTS[glowType].RIGHT1.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].RIGHT1.RADIUS}),
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].MAIN.X} ${GLOW_EFFECTS[glowType].MAIN.Y}, ${GLOW_EFFECTS[glowType].MAIN.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].MAIN.RADIUS}),
      radial-gradient(circle at ${GLOW_EFFECTS[glowType].RIGHT2.X} ${GLOW_EFFECTS[glowType].RIGHT2.Y}, ${GLOW_EFFECTS[glowType].RIGHT2.COLOR} 0, transparent ${GLOW_EFFECTS[glowType].RIGHT1.RADIUS})
    `
    },
    //
    settings: 'row-center ml-1',
    title: cn('text-sm w-28', fg('text.digest')),

    icon: cn('size-12', fill('text.title')),
  }
}
