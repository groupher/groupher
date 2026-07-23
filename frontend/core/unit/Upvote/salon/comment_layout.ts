import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  viewerHasUpvoted: boolean
}

export default function useSalon({ viewerHasUpvoted }: TProps) {
  const { cn, br, bg, fg, rainbowLite, primary } = useTwBelt()
  const color = usePrimaryColor()

  return {
    wrapper: 'row-center',
    button: cn(
      'align-both min-w-20 py-1 border rounded-lg pointer',
      `hover:${br('digest')}`,
      `hover:${bg('alphaBg2')}`,
      'trans-all-200',
      viewerHasUpvoted && rainbowLite(color),

      br('divider'),
    ),
    alias: cn('ml-1 mr-2 mt-0.5 text-xs bold-sm', viewerHasUpvoted ? primary('fg') : fg('digest')),
  }
}
