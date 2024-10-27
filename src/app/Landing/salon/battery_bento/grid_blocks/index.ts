import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, fill, rainbow, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-[1400px] h-auto mb-16 px-44'),
    inner: 'row wrap w-full h-auto relative',
    block: 'column w-1/3 h-48 px-10 py-5',
    title: cn('text-base bold-sm mt-5 mb-1.5', fg('text.digest')),
    desc: cn('text-sm', fg('text.digest')),
    //
    iconBox: 'align-both size-8',
    blockIcon: cn('size-7 opacity-50'),

    vibeIcon: cn('absolute size-4 rotate-180 trans-all-200	!duration-1000', fill('text.digest')),
    vibeDown: '-rotate-90 opacity-30',

    fillPurple: rainbow(COLOR_NAME.PURPLE, 'fill'),
    fillRed: rainbow(COLOR_NAME.RED, 'fill'),
    fillGreen: rainbow(COLOR_NAME.GREEN, 'fill'),
    fillOrange: rainbow(COLOR_NAME.ORANGE, 'fill'),
    fillBlue: rainbow(COLOR_NAME.BLUE, 'fill'),
    fillCyan: rainbow(COLOR_NAME.CYAN, 'fill'),
    //
    line: cn('absolute top-0 h-full w-px', bg('divider')),
    rowLine: cn('absolute', sexyHBorder(35)),
  }
}
