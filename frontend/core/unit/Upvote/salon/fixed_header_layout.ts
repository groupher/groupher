import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  viewerHasUpvoted: boolean
}

export default function useSalon({ viewerHasUpvoted }: TProps) {
  const { cn, fg, primary } = useTwBelt()

  return {
    wrapper: 'row-center',
    count: cn(
      'pretty-num bold-sm ml-1.5 text-base',
      viewerHasUpvoted ? primary('fg') : fg('digest'),
    ),
  }
}
