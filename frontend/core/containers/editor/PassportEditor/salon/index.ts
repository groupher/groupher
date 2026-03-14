import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, rainbow, sexyBorder } = useTwBelt()

  return {
    wrapper: 'px-8 py-6',
    desc: cn('text-xs mt-1', fg('hint')),
    footer: 'align-both w-full pr-12 gap-x-3.5',
    rootSign: cn(
      'text-xs px-1.5 py-px rounded mb-1 border bold',
      rainbow(COLOR.BLUE, 'bgSoft'),
      rainbow(COLOR.BLUE, 'border'),
    ),
    divider: cn(sexyBorder(), 'mb-8'),
  }
}
