import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color?: TColorName
}

export default function useSalon({ color }: TProps) {
  const { cn, rainbow, fg, fill } = useTwBelt()

  const fillColor = color ? rainbow(COLOR[color], 'fill') : fill('digest')
  const textColor = color ? rainbow(COLOR[color], 'fg') : fg('digest')

  return {
    wrapper: cn(
      'row-center px-1.5 py-0.5 border border-dotted rounded-md',
      rainbow(COLOR[color], 'borderSoft'),
    ),
    text: cn('text-xs ml-1.5', textColor),
    count: cn('text-xs ml-1.5 bold-sm ml-1', textColor),
    upvoteIcon: cn('size-3 -mt-px opacity-80', fillColor),
  }
}
