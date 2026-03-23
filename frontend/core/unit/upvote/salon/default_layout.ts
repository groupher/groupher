import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  viewerHasUpvoted: boolean
}

export default function useSalon({ viewerHasUpvoted }: TProps) {
  const { cn, br, bg, fg, rainbowSoft } = useTwBelt()
  const color = usePrimaryColor()

  return {
    wrapper: 'row-center',
    button: cn(
      'align-both min-w-10 h-11 mr-6 px-3 rounded-xl border',
      `hover:${br('digest')}`,
      `hover:${bg('alphaBg2')}`,
      'trans-all-200',
      br('divider'),
      viewerHasUpvoted && cn(rainbowSoft(color)),
    ),
    digest: 'column items-start',
    note: cn('row-center text-xs mt-0.5', fg('digest')),
    user: cn('bold max-w-12 truncate -ml-0.5', fg('digest')),
  }
}
