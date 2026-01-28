import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'row w-full h-5/6 relative mt-5',
      'animate-fade-up animate-duration-500 animate-ease-in-out',
    ),
    notes: cn('text-sm absolute bottom-8 left-12 opacity-80', fg('digest')),
    highlight: cn('bold-sm ml-1 mr-1', rainbow(COLOR_NAME.PINK, 'fg')),
  }
}
