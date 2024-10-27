import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('row-center-between absolute left-0 top-0 w-full h-8 px-3 trans-all-200'),
    actions: 'row-center mt-1.5',
    dot: 'size-2 circle ml-2 brightness-125',
    redBg: rainbow(COLOR_NAME.RED, 'bg'),
    yellowBg: rainbow(COLOR_NAME.YELLOW, 'bg'),
    greenowBg: rainbow(COLOR_NAME.GREEN, 'bg'),
    moreIcon: cn('size-3.5', rainbow(COLOR_NAME.GREEN, 'fill')),

    domain: cn(
      'brightness-50 w-28 h-5 mt-1 rounded-md px-2 opacity-50',
      rainbow(COLOR_NAME.GREEN, 'bgSoft'),
    ),

    domainText: cn('absolute left-1/2 top-2.5 -ml-3.5 text-xs bold', fg('button.fg')),
  }
}
