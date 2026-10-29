import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'row-center absolute bottom-3 left-1/2 h-5 w-11/12 -translate-x-1/2 gap-1 overflow-hidden px-2',
      rainbow(COLOR.ORANGE, 'bgLite'),
    ),
    codes: cn('min-w-0 flex-1 truncate whitespace-nowrap text-xs', fg('digest')),
    embed: cn('bold-sm', fg('title')),
    redText: rainbow(COLOR.RED, 'fg'),

    icon: cn('size-3', fill('digest')),
    cursor: cn('h-2 w-0.5 shrink-0 rounded opacity-80 animate-ping', rainbow(COLOR.RED, 'bg')),
  }
}
