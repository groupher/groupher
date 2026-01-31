import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill, bg, shadow, br, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute left-4 bottom-24 align-both gap-x-0.5 w-64 h-9 z-40 -mt-3.5 border rounded-md',
      bg('card'),
      br('rainbow.redSoft'),
      shadow('xl'),
    ),
    item: 'column-align-both size-8 mt-0.5',
    title: cn('text-xs scale-75 opacity-80', fg('digest')),
    colorBall: cn('size-3 circle', rainbow(COLOR.RED, 'bgSoft')),

    icon: cn('size-3', fill('digest')),
  }
}
