import SIZE from '~/const/size'
import useTwBelt from '~/hooks/useTwBelt'

import type { TAvatarSize } from '../spec'

type TProps = {
  size: TAvatarSize
  isFirst: boolean
  isLast: boolean
  selectable: boolean
}

export default function useSalon({ size, isFirst, isLast, selectable }: TProps) {
  const { cn, br, avatar } = useTwBelt()

  return {
    wrapper: cn(
      'relative -ml-1 z-10 list-none shrink-0 overflow-hidden border-2',
      size === SIZE.SMALL ? 'size-5' : 'size-6',
      'transition-transform duration-200 ease-out hover:scale-125 hover:z-30 hover:shadow-md',
      !isFirst && 'hover:ml-0.5',
      !isLast && 'hover:mr-1',
      br('divider'),
      avatar(),
    ),
    avatarControl: cn(
      'plain-button abs-full overflow-hidden text-center text-xs outline-none',
      selectable ? 'pointer' : 'cursor-default',
      avatar(),
    ),
    avatarImage: cn('abs-full z-10 block object-cover', avatar()),
    avatarFallback: cn('abs-full z-0', br('divider')),
  }
}
