import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, fill, rainbow, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'column gap-y-4 p-4 w-64 h-[500px] rounded-tl-md rounded-tr-md border-b-none',
      bg('htmlBg'),
      rainbow(COLOR_NAME.PURPLE, 'borderSoft'),
      shadow('sm'),
    ),
    header: 'row-center mb-1',
    iconBox: 'align-both size-3.5 mr-1.5',
    title: 'text-xs',
    size: cn('text-xs', fg('text.digest')),
    textGreen: rainbow(COLOR_NAME.GREEN, 'fg'),
    textRed: rainbow(COLOR_NAME.RED, 'fg'),
    //
    barTrack: cn('h-1 w-full mt-2 rounded-md', bg('divider')),
    bar: cn('h-full opacity-60', bg('text.digest')),
    barGreen: rainbow(COLOR_NAME.GREEN, 'bg'),
    barRed: rainbow(COLOR_NAME.RED, 'bg'),
    //
    loading: cn('size-3.5 ml-1.5 animate-spin', fill('text.title')),
  }
}
