import SIZE from '~/const/size'
import useTwBelt from '~/hooks/useTwBelt'

import type { TAvatarSize } from '../spec'

type TProps = {
  size?: TAvatarSize
  interactive: boolean
}

export default function useSalon({ size, interactive }: TProps) {
  const { cn, avatar, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'relative -ml-1 z-20 list-none shrink-0',
      size === SIZE.SMALL ? 'size-5' : 'size-6',
    ),
    control: cn(
      'plain-button align-both s-full border border-dashed border-transparent',
      interactive ? 'pointer' : 'cursor-default',
      interactive && `hover:${br('digest')}`,
      'transition-colors duration-200 ease-out',
      bg('hoverBg'),
      avatar(),
    ),
    textMore: cn('align-both text-lg s-full pb-2', fg('hint')),
  }
}
