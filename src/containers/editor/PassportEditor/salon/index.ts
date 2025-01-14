import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, rainbow, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn('px-8 py-6'),
    desc: cn('text-xs mt-1', fg('text.hint')),
    footer: 'align-both w-full pr-12 gap-x-3.5',
    rootSign: cn(
      'text-xs px-1.5 py-px rounded mb-1 border bold',
      rainbow(COLOR_NAME.BLUE, 'bgSoft'),
      rainbow(COLOR_NAME.BLUE, 'border'),
    ),
    divider: cn(sexyHBorder(), 'mb-8'),
  }
}
