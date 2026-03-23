import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  viewerHasUpvoted: boolean
}

export default function useSalon({ viewerHasUpvoted }: TProps) {
  const { cn, fg, primary } = useTwBelt()

  return {
    wrapper: 'row-center',
    count: cn('bold-sm text-base ml-1.5', viewerHasUpvoted ? primary('fg') : fg('digest')),
  }
}
