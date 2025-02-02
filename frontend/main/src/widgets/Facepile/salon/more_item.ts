import useTwBelt from '~/hooks/useTwBelt'

import SIZE from '~/const/size'
import type { TAvatarSize } from '../spec'

type TProps = {
  size?: TAvatarSize
}

export default ({ size }: TProps) => {
  const { cn, avatar, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'align-both border border-dashed border-transparent pointer',
      size === SIZE.SMALL ? 'size-5' : 'size-6',
      `hover:${br('text.digest')}`,
      'trans-all-200',
      bg('hoverBg'),
      avatar(),
    ),
    textMore: cn('align-both text-lg h-full w-full pb-2', fg('text.hint')),
  }
}
