import useTwBelt from '~/hooks/useTwBelt'

export type TColorItemSize = 'large' | 'compact'

type TArgs = {
  size: TColorItemSize
}

export default function useSalon({ size }: TArgs) {
  const { cn, fg } = useTwBelt()
  const isCompact = size === 'compact'

  return {
    item: 'w-2/5 min-w-2/5',
    head: cn('row-center', isCompact && 'mt-0.5 mb-4'),
    title: cn('text-sm ml-3', fg('title')),
    desc: cn('text-sm mt-3', fg('digest')),
    ballWrapper: cn('align-both circle border pointer', isCompact ? 'size-7' : 'size-9'),
    colorBall: cn('circle', isCompact ? 'size-5' : 'size-7'),
  }
}
