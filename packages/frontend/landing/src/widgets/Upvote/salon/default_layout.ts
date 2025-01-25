import useTwBelt from '~/hooks/useTwBelt'
import usePrimaryColor from '~/hooks/usePrimaryColor'

type TProps = {
  viewerHasUpvoted: boolean
}

export default ({ viewerHasUpvoted }: TProps) => {
  const { cn, br, bg, fg, rainbowSoft } = useTwBelt()
  const color = usePrimaryColor()

  return {
    wrapper: 'row-center',
    button: cn(
      'align-both min-w-10 h-11 mr-6 px-3 rounded-xl border',
      `hover:${br('text.digest')}`,
      `hover:${bg('alphaBg2')}`,
      'trans-all-200',
      br('divider'),
      viewerHasUpvoted && cn(rainbowSoft(color)),
    ),
    digest: 'column items-start',
    note: cn('row-center text-xs mt-0.5', fg('text.digest')),
    user: cn('bold max-w-12 truncate -ml-0.5', fg('text.digest')),
  }
}
