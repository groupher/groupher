import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'column mt-6',
    title: cn('text-xl bold-sm mt-1', rainbow(COLOR.PURPLE, 'fg')),
    digest: cn('w-80 text-base mt-4 leading-relaxed opacity-80', fg('digest')),
    highlight: cn(
      'bold-sm italic ml-px mr-px px-0.5',
      rainbow(COLOR.PURPLE, 'fg'),
      rainbow(COLOR.PURPLE, 'bgSoft'),
    ),
  }
}
