import type { TActive } from '~/spec'

import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'
type TProps = TActive

export default ({ active }: TProps) => {
  const { cn, fg, bg, br, fill, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn('row h-12 px-1.5 py-1 mb-2.5', bg('htmlBg')),
    upvote: cn(
      'column-align-both size-10 rounded-md border',
      br('text.digest'),
      shadow('sm'),
      !active && 'border-dotted',
      active && rainbow(COLOR_NAME.PURPLE, 'bgSoft'),
      active && rainbow(COLOR_NAME.PURPLE, 'borderSoft'),
    ),
    upvoteIcon: cn('size-3', fill('text.digest'), active && rainbow(COLOR_NAME.PURPLE, 'fill')),
    count: cn('text-xs bold mt-0.5', fg('text.digest'), active && rainbow(COLOR_NAME.PURPLE, 'fg')),
    //
    rightPart: 'column ml-3.5',
    title: cn('text-sm bold-sm', fg('text.title')),
    footer: 'scale-90 w-32 mt-1 -ml-3.5',
  }
}
