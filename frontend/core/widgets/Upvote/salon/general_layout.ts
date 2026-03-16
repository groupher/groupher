import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  viewerHasUpvoted: boolean
}

export default function useSalon({ viewerHasUpvoted }: TProps) {
  const { cn, bg, br, rainbowSoft, vividDark } = useTwBelt()
  const color = usePrimaryColor()

  return {
    wrapper: cn('align-both', vividDark()),
    button: cn(
      'row-center h-5 border border-transparent rounded-md pl-1 pr-1.5 -ml-1.5',
      'hover:ml-px',
      'hover:mr-2',
      `hover:${br('digest')}`,
      `hover:${bg('alphaBg2')}`,
      'trans-all-200',
      viewerHasUpvoted && cn('mr-2 ml-px pr-2', br('divider'), rainbowSoft(color)),
    ),
    upvote: 'align-both scale-90',
    lineDivider: cn('h-3 w-px ml-2 mr-2.5', bg('divider')),
  }
}
