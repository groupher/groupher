import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, shadow, fg, bg, br, fill, rainbow } = useTwBelt()

  return {
    wrapper: 'row items-end relative',
    listCard: cn(
      'relative h-96 p-6 rounded-xl mb-5 border',
      shadow('card'),
      br('rainbow.purpleSoft'),
      bg('cardAlpha'),
    ),

    // detail card
    detailCard: cn(
      'relative grow w-80 -ml-5 mt-4 p-8 pt-5 z-20 rounded-xl border',
      shadow('card'),
      br('rainbow.purpleSoft'),
      bg('card'),
    ),
    header: 'row-center mb-2.5 scale-90 -ml-5',
    tagBox: cn('row-center border rounded-md px-1.5 py-0.5', br('divider')),
    tag: cn('text-xs', fg('title')),
    title: cn('text-base', fg('title')),
    status: 'row-center mt-2.5 mb-6',
    upvote: cn(
      'row-center px-1.5 py-px mt-0.5 rounded-md border',
      fg('title'),
      rainbow(COLOR_NAME.PURPLE, 'bgSoft'),
      rainbow(COLOR_NAME.PURPLE, 'borderSoft'),
    ),
    icon: cn('size-3', rainbow(COLOR_NAME.PURPLE, 'fill')),
    count: cn('text-sm bold-sm ml-1', rainbow(COLOR_NAME.PURPLE, 'fg')),
    commentIcon: cn('size-2.5 opacity-80', fill('digest')),
    commentCount: cn('text-sm ml-1', fg('digest')),

    //
    commentsHeader: cn('row-center text-xs mt-6 mb-4', fg('digest')),
    content: 'relative h-16',
    bar: cn('absolute h-1.5 w-20 rounded-md opacity-30', bg('text.digest')),
  }
}
