import useTwBelt from '~/hooks/useTwBelt'

type TArgs = {
  isLarge: boolean
}

export default function useSalon({ isLarge }: TArgs) {
  const { cn, fg } = useTwBelt()

  return {
    item: 'w-2/5 min-w-2/5',
    head: cn('row-center', !isLarge && 'mt-0.5 mb-4'),
    title: cn('text-sm', isLarge ? 'ml-2.5' : 'ml-3', fg('title')),
    desc: cn('text-sm mt-3', fg('digest')),
    ballWrapper: cn('align-both circle border pointer', isLarge ? 'size-9 -ml-1' : 'size-7'),
    colorBall: cn('circle', isLarge ? 'size-7' : 'size-5'),
  }
}
