import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn('p-4 w-full h-80'),
    content: cn(
      'column items-start relative mt-2.5 rounded-md p-2.5 w-full h-5/6 border',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    header: 'row-center relative',
    mention: cn('text-xs ml-2', rainbow(COLOR_NAME.BLUE, 'fg')),
    text: cn('text-xs ml-2 mt-0.5 z-10', fg('text.digest')),

    highlight: cn(
      'absolute left-1 top-5 w-10 h-4 group-smoky-0',
      rainbow(COLOR_NAME.CYAN, 'bgSoft'),
    ),

    pic: 'w-full h-16 mt-2 ml-2 object-cover	rounded-md opacity-50',
  }
}
