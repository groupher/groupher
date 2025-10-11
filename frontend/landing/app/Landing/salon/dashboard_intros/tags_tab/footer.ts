import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, shadow, fg, bg, fill, global, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'row h-40 w-[460px] rounded-lg absolute bottom-10 -left-5 z-30 p-1',
      shadow('sm'),
      bg('container'),
    ),
    inner: cn('row w-full h-full rounded-xl py-4 px-6', global('gradient-green')),
    left: 'w-1/2',
    right: 'w-1/2',
    item: 'row items-start h-8',
    label: cn('text-xs min-w-20 mt-0.5', fg('text.digest')),
    value: cn('text-xs leading-relaxed opacity-90', fg('text.title')),
    //
    colorDot: cn('size-3.5 opacity-40 rounded mt-0.5', rainbow(COLOR_NAME.GREEN, 'bg')),
    hashTagIcon: cn('size-3.5 opacity-65', rainbow(COLOR_NAME.GREEN, 'fill')),
    clipIcon: cn(
      'size-5 absolute right-10 -top-2 z-50 -rotate-12 opacity-65',
      rainbow(COLOR_NAME.GREEN, 'fill'),
    ),
    optArrowIcon: cn('size-3 ml-1.5 mt-0.5', fill('text.digest')),
    //
    slash: cn('text-xs ml-1.5 mr-1.5 opacity-50', rainbow(COLOR_NAME.GREEN, 'fg')),
    dotTag: cn('size-2.5 circle opacity-50', rainbow(COLOR_NAME.GREEN, 'bg')),
  }
}
