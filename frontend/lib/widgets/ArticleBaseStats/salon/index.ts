import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, fill, margin, hoverable } = useTwBelt()

  return {
    wrapper: cn('row-center leading-5', margin(spacing)),
    viewsIcon: cn('size-3.5 mr-1', fill('text.digest')),
    commentBox: cn('align-both size-3.5', hoverable('bg')),
    commentIcon: cn('size-3', hoverable('icon')),
    divider: 'mr-2.5',
    count: cn('text-base ml-0.5', fg('text.digest')),
    commentCount: cn('ml-2 text-base ml-0.5', hoverable('fg')),
  }
}
