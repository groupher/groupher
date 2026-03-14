import { COLOR } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, fill, rainbow, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column-align-both w-[1400px] h-auto mb-16 px-44',
    inner: 'row wrap w-full h-auto relative',
    block: 'column w-1/3 h-48 px-10 py-5',
    title: cn('text-base mt-5 mb-1.5', fg('title')),
    desc: cn('text-sm', fg('digest')),
    //
    iconBox: 'align-both size-8',
    blockIcon: 'size-7 opacity-50',

    vibeIcon: cn(
      'absolute size-4 rotate-180 trans-all-200 !duration-1000',
      fill('digest'),
      !isLightTheme && 'opacity-25',
    ),
    vibeDown: cn('-rotate-90 opacity-30', isLightTheme ? 'opacity-30' : 'opacity-10'),

    fillPurple: rainbow(COLOR.PURPLE, 'fill'),
    fillRed: rainbow(COLOR.RED, 'fill'),
    fillGreen: rainbow(COLOR.GREEN, 'fill'),
    fillOrange: rainbow(COLOR.ORANGE, 'fill'),
    fillBlue: rainbow(COLOR.BLUE, 'fill'),
    fillCyan: rainbow(COLOR.CYAN, 'fill'),
    //
    line: cn('absolute top-0 h-full w-px', bg('divider')),
    rowLine: cn('absolute', sexyBorder()),
  }
}
