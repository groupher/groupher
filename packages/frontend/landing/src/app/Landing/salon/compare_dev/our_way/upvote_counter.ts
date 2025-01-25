import type { TColorName } from '~/spec'

import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  color?: TColorName
}

export default ({ color }: TProps) => {
  const { cn, rainbow, fg, fill } = useTwBelt()

  const fillColor = color ? rainbow(COLOR_NAME[color], 'fill') : fill('text.digest')
  const textColor = color ? rainbow(COLOR_NAME[color], 'fg') : fg('text.digest')

  return {
    wrapper: cn(
      'row-center px-1.5 py-0.5 border border-dotted rounded-md',
      rainbow(COLOR_NAME[color], 'borderSoft'),
    ),
    text: cn('text-xs ml-1.5', textColor),
    count: cn('text-xs ml-1.5 bold-sm ml-1', textColor),
    upvoteIcon: cn('size-3 -mt-px opacity-80', fillColor),
  }
}
