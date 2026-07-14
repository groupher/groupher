import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, fg, fill, margin, hover } = useTwBelt()

  return {
    wrapper: cn('row-center leading-5', margin(spacing)),
    viewsIcon: cn('size-3.5 mr-1', fill('digest')),
    commentBox: cn('align-both size-3.5', hover('bg')),
    commentIcon: cn('size-3', hover('icon')),
    divider: 'mr-2.5',
    count: cn('pretty-num ml-0.5 text-base', fg('digest')),
    commentCount: cn('pretty-num ml-0.5 ml-2 text-base', hover('fg')),
  }
}
