import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, rainbow, shadow } = useTwBelt()

  return {
    wrapper: cn('w-full h-full p-4 pt-7 overflow-hidden relative'),
    nestIcon: cn(
      'absolute size-44 rotate-45 top-0 left-10 opacity-10 trans-all-200',
      rainbow(COLOR_NAME.GREEN, 'fill'),
    ),
    nextIconHover: '-rotate-12 top-6 left-20 size-44',
    //
    blocks: cn('row-center wrap mt-1.5 gap-3 trans-all-200'),
    brick: cn(
      'align-both px-2 z-20 border h-8 rounded-md trans-all-100',
      rainbow(COLOR_NAME.GREEN, 'borderSoft'),
      shadow('sm'),
      bg('htmlBg'),
    ),
    icon: cn('size-3', rainbow(COLOR_NAME.GREEN, 'fill')),
    title: cn('text-xs ml-1', fg('text.digest')),
  }
}
