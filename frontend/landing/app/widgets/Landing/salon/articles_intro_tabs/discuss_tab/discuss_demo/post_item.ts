import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import type { TActive } from '~/spec'

export { cn } from '~/css'

type TProps = TActive

export default ({ active }: TProps) => {
  const { cn, fg, br, fill, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn('row h-12 px-1.5 py-1 mb-2.5'),
    upvote: cn(
      'column-align-both size-10 rounded-md border',
      br('rainbow.purpleSoft'),
      shadow('card'),
      !active && 'border-dotted',
      active && rainbow(COLOR_NAME.PURPLE, 'bgSoft'),
      active && rainbow(COLOR_NAME.PURPLE, 'borderSoft'),
    ),
    upvoteIcon: cn('size-3', fill('digest'), active && rainbow(COLOR_NAME.PURPLE, 'fill')),
    count: cn('text-xs bold mt-0.5', fg('digest'), active && rainbow(COLOR_NAME.PURPLE, 'fg')),
    //
    rightPart: 'column ml-3.5',
    title: cn('text-sm bold-sm', fg('title')),
    footer: 'scale-90 w-32 mt-1 -ml-3.5',
  }
}
