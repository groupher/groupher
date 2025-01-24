import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, fill, global, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn('absolute top-44 mt-0.5 left-8 w-full h-5/6'),
    postItemWrapper: cn(
      'absolute -top-2 rounded-t-xl p-1 z-30 border border-dashed',
      bg('card'),
      rainbow(COLOR_NAME.BLUE, 'borderSoft'),
    ),
    postItem: cn(
      'align-both w-24 h-8 rounded-t-md',
      'text-xs',
      fg('text.digest'),
      global('gradient-blue'),
      shadow('xl'),
    ),
    item: cn(
      'absolute p-1 z-20 align-both w-20 h-8 rounded-t-2xl border border-dashed',
      'text-xs',
      fg('text.digest'),
      bg('card'),
      rainbow(COLOR_NAME.BLUE, 'borderSoft'),
    ),
    bottomItem: cn(
      'row-center w-80 absolute left-12 bottom-20 mb-2 py-2 px-3 rounded-b-xl border',
      br('divider'),
      shadow('xl'),
    ),
    bottomGradient: cn(
      'absolute top-0 left-0 w-full h-full rotate-180 -z-10 opacity-50',
      global('gradient-blue'),
    ),
    icon: cn('size-3 mr-1', fill('text.digest')),
    title: cn('text-xs', fg('text.digest')),
  }
}
