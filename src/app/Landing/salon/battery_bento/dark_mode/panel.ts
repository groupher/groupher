import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, fill, rainbow, shadow } = useTwBelt()

  return {
    wrapper: cn('align-both w-full h-72 relative mt-3'),
    divideColumn: cn(
      'absolute left-30 top-3 w-1 h-40 rounded-md z-10 opacity-65 trans-all-200',
      rainbow(COLOR_NAME.RED, 'bg'),
    ),
    //
    switchBox: cn(
      'absolute row-center-between px-1 w-16 h-7 z-20 rounded-lg border scale-90 trans-all-200',
      br('divider'),
      bg('alphaBg'),
      shadow('xl'),
    ),
    themeBox: cn('align-both size-6 border border-transparent rounded-md trans-all-200'),
    boxSolid: cn(br('divider'), rainbow(COLOR_NAME.CYAN, 'bg'), 'opacity-80'),
    icon: cn('size-4', fill('text.title')),
    iconSolid: fill('button.fg'),

    //
    cardFooter: 'row-center mt-1 w-full',
    card: cn('column w-28 h-32 p-2.5 rounded-lg border trans-all-200', shadow('sm'), br('divider')),
    lightBg: 'bg-htmlBg',
    darkBg: bg('htmlBg', 'dark'),
    lightText: 'text-text-title',
    darkText: fg('text.title', 'dark'),

    lightFill: 'fill-text-title',
    darkFill: fill('text.title', 'dark'),

    lightBox: 'bg-hoverBg',
    darkBox: bg('hoverBg', 'dark'),
  }
}
