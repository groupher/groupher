import useTwBelt from '~/hooks/useTwBelt'

import { COLOR_NAME } from '~/const/colors'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, rainbow, shadow, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn(
      'column items-start relative mt-4 w-[348px] h-[460px] rounded-md border',
      'pl-10',
      bg('htmlBg'),
      br('divider'),
      shadow('sm'),
    ),
    header: 'column w-48 mt-6 mb-2.5',
    title: cn('row-center text-base', fg('text.title')),
    version: cn('opacity-80 text-sm ml-2 mt-0.5 italic', fg('text.digest')),

    tags: cn('row-center mt-0.5 gap-x-2', fg('text.digest')),
    tagItem: 'row-center text-xs',
    content: 'column mt-4 w-52 gap-2.5',
    //
    divider: cn('mt-8 -ml-4', sexyHBorder(35)),
    cover: cn(
      'relative w-44 h-24 overflow-hidden rounded mb-1 border border-dashed',
      bg('hoverBg'),
      br('divider'),
    ),
    bar: cn('w-40 h-1.5 opacity-30', bg('text.digest')),
    starIcon: 'absolute size-4 z-30',
    starYellow: rainbow(COLOR_NAME.YELLOW, 'fill'),
    starRed: rainbow(COLOR_NAME.PINK, 'fill'),
    starOrange: rainbow(COLOR_NAME.ORANGE, 'fill'),
  }
}
