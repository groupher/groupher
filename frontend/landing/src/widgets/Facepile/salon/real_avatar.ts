// import { getLiSize, getAvatarSize } from './metric'

import useTwBelt from '~/hooks/useTwBelt'

import SIZE from '~/const/size'
import type { TAvatarSize } from '../spec'

type TProps = {
  size: TAvatarSize
  isFirst: boolean
  isLast: boolean
}

export default ({ size, isFirst, isLast }: TProps) => {
  const { cn, br, avatar } = useTwBelt()

  return {
    wrapper: cn(
      'relative -ml-1 border-2 overflow-hidden',
      size === SIZE.SMALL ? 'size-5' : 'size-6',
      'hover:scale-125 hover:z-30 hover:border-none hover:shadow-md',
      !isFirst && 'hover:ml-0.5',
      !isLast && 'hover:mr-1',
      'trans-all-200 ',
      br('divider'),
      avatar(),
    ),
    avatar: cn('text-xs w-full h-full text-center'),
    avatarFallback: cn('border', br('divider')),
  }
}
