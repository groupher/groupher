import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, shadow, rainbow, global } = useTwBelt()

  return {
    wrapper: cn(
      'column border w-[460px] h-[452px] rounded-xl z-30 py-5',
      'absolute bottom-16 left-0',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    item: cn('row-center h-12 w-full relative border-b border-dotted px-1', br('divider')),
    itemGrey: bg('sandBox'),
    itemBlue: global('gradient-blue'),
    title: cn('text-xs line-clamp-1', fg('text.title')),
    //
    falseChecker: cn('size-3.5 border rounded ml-5', shadow('sm'), br('divider'), bg('htmlBg')),
    //
    tip: cn(
      'align-both absolute h-9 w-auto px-3 text-sm rounded-xl border z-20',
      shadow('sm'),
      br('divider'),
      fg('text.digest'),
      bg('htmlBg'),
    ),
    tipLogo: cn(
      'size-3.5 mr-1.5 brightness-110 saturate-150 opacity-65',
      rainbow(COLOR_NAME.BLUE, 'fill'),
    ),
    //
    bar: cn('h-1.5 w-10/12 ml-3.5 rounded-md opacity-10', bg('text.digest')),
    curveLine: cn(
      'absolute top-24 left-52 size-40 z-20 -rotate-6 opacity-40 brightness-110',
      rainbow(COLOR_NAME.BLUE, 'fill'),
    ),
  }
}
