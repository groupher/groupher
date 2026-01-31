import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'row-center relative w-auto px-3.5 py-1 rounded-xl -ml-2.5 border border-dashed',
      rainbow(COLOR.RED, 'borderSoft'),
      bg('card'),
    ),
    dot: cn('size-1.5 circle absolute -left-1 z-20 opacity-65', rainbow(COLOR.RED, 'bg')),
    buildIcon: 'text-xs opacity-65',
    text: cn('text-sm ml-1.5', fg('digest')),
    textRed: rainbow(COLOR.RED, 'fg'),
    graveIcon: cn('size-4 opacity-65', rainbow(COLOR.PINK, 'fill')),
    launchIcon: cn('size-3', fill('digest')),
  }
}
