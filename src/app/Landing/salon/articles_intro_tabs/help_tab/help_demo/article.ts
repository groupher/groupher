import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, fill, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column-center relative -ml-10 z-10 w-96 h-[480px] rounded-md gap-2.5',
      bg('htmlBg'),
      shadow('sm'),
    ),
    underPaper: cn(
      'absolute -top-0.5 -right-1 w-96 h-1/2 -z-10 rotate-3 border rounded-md',
      br('divider'),
      bg('htmlBg'),
      shadow('sm'),
    ),
    //
    title: cn('row-center text-base', fg('text.title')),
    inner: cn(
      'column-center w-full h-full z-10 px-4 py-8 pt-6 border',
      br('divider'),
      bg('htmlBg'),
    ),
    content: 'column relative w-64',
    //
    shareIcon: cn('size-3 absolute top-1.5 -right-0.5 opacity-30', fill('text.digest')),
    //
    footer: 'row-center mt-10 w-10/12',
    feedback: cn(
      'align-both gap-x-4 rounded-xl px-4 py-2 mt-4 w-32 border',
      br('divider'),
      shadow('sm'),
    ),
    feedIcon: 'size-5 opacity-80',
    arrowIcon: cn('size-4 opacity-80', fill('text.digest')),
    arrowText: cn('text-xs opacity-80', fg('text.digest')),
    //
    bar: cn('h-1.5 w-40 mt-4 opacity-30 rounded-md', bg('text.digest')),
    // cover
    coverWrapper: cn(
      'relative row-center-between mt-5 mb-4 w-64 h-24 rounded-md opacity-25',
      rainbow('CYAN', 'bg'),
    ),
    slash: cn('absolute h-28 w-1 left-1/2 top-0 rotate-12', bg('htmlBg')),
    coverText: cn('text-lg absolute bold', fg('button.fg')),
    // comment
    commentDot: cn(
      'align-both absolute right-32 bottom-52 size-3.5 z-50',
      rainbow(COLOR_NAME.CYAN, 'bgSoft'),
    ),
    commentSolid: cn('size-2 circle opacity-80', rainbow(COLOR_NAME.CYAN, 'bg')),
  }
}
