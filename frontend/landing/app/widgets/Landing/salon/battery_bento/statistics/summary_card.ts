import { COLOR } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, br, fg, bg, shadow, rainbow, dimDark } = useTwBelt()

  return {
    wrapper: cn(
      'row-center wrap absolute top-20 left-5 py-1 w-36 h-24 rounded-lg border z-30',
      br('divider'),
      bg('card'),
      shadow('sm'),
    ),
    block: 'relative w-1/2 h-10 px-2.5 py-0.5',
    title: cn('text-xs scale-90 -ml-1', fg('hint')),
    num: cn('row-center text-sm bold-sm overflow-hidden', fg('title'), isDarkTheme && dimDark()),

    icon: 'size-3 ml-2',
    iconGreen: rainbow(COLOR.GREEN, 'fill'),
    iconRed: rainbow(COLOR.RED, 'fill'),
  }
}
