import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, fill, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column justify-between rounded-md h-16 px-2 py-1.5 border',
      bg('htmlBg'),
      br('divider'),
    ),

    draging: cn(
      '-rotate-3 scale-95 ml-1 -mr-1 z-50',
      shadow('xl'),
      rainbow(COLOR_NAME.BLUE, 'border'),
    ),
    target: cn(
      'align-both text-sm w-11/12 min-h-12 ml-1.5 mt-1 mb-1 rounded-md italic border border-dashed',
      rainbow(COLOR_NAME.GREEN, 'border'),
      rainbow(COLOR_NAME.GREEN, 'fg'),
    ),
    //
    title: cn('text-xs mt-0.5 opacity-90', fg('text.title')),
    footer: 'row-center w-full scale-90 mt-2',
    upvoteIcon: cn('size-3 -ml-2.5', fill('text.digest')),
    count: cn('text-sm ml-1 mt-px grow', fg('text.digest')),
  }
}
