import { COLOR } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, br, fill, shadow, rainbow, vividDark } = useTwBelt()

  return {
    wrapper: cn(
      'column-center relative -ml-10 z-10 w-96 h-[480px] rounded-md gap-2.5',
      bg('card'),
      shadow('card'),
    ),
    underPaper: cn(
      'absolute -top-0.5 -right-2 w-96 h-1/2 -z-10 rotate-3 border rounded-md',
      br('rainbow.cyanSoft'),
      bg('cardAlpha'),
      shadow('card'),
    ),
    //
    title: cn('row-center text-base', fg('title')),
    inner: cn(
      'column-center s-full z-10 px-4 py-8 pt-6 border rounded-md',
      br('rainbow.cyanSoft'),
      bg('card'),
    ),
    content: 'column relative w-64',
    //
    shareIcon: cn('size-3 absolute top-1.5 -right-0.5 opacity-30', fill('digest')),
    //
    footer: 'row-center mt-10 w-10/12',
    feedback: cn(
      'align-both gap-x-4 rounded-xl px-4 py-2 mt-4 w-32 border',
      br('divider'),
      shadow('card'),
    ),
    feedIcon: 'size-5 opacity-80',
    arrowIcon: cn('size-4 opacity-80', fill('digest')),
    arrowText: cn('text-xs opacity-80', fg('digest')),
    //
    bar: cn('h-1.5 w-40 mt-4 opacity-30 rounded-md', bg('text.digest')),
    // cover
    coverWrapper: cn(
      'relative row-between mt-5 mb-4 w-64 h-24 rounded-md',
      isLightTheme ? 'opacity-25' : 'opacity-40',
      rainbow(COLOR.CYAN, 'bg'),
    ),
    slash: cn('absolute h-28 w-1 left-1/2 top-0 rotate-12', bg('card')),
    coverText: cn('text-lg absolute bold', fg('button.fg'), vividDark()),
    // comment
    commentDot: cn(
      'align-both absolute right-32 bottom-52 size-3.5 z-50',
      rainbow(COLOR.CYAN, 'bgSoft'),
    ),
    commentSolid: cn('size-2 circle opacity-80', rainbow(COLOR.CYAN, 'bg')),
  }
}
