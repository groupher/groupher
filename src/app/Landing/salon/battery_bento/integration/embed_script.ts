import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'row-center absolute bottom-3 h-5 w-11/12 pl-2',
      rainbow(COLOR_NAME.ORANGE, 'bgSoft'),
    ),
    codes: cn('text-xs scale-90 -ml-1', fg('text.digest')),
    embed: cn('bold-sm', fg('text.title')),
    redText: cn(rainbow(COLOR_NAME.RED, 'fg')),

    icon: cn('size-3', fill('text.digest')),
    cursor: cn('w-0.5 rounded h-2 opacity-80 animate-ping', rainbow(COLOR_NAME.RED, 'bg')),
  }
}
