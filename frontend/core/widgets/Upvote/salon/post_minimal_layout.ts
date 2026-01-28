import usePrimaryColor from '~/hooks/usePrimaryColor'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  viewerHasUpvoted: boolean
}

export default ({ viewerHasUpvoted }: TProps) => {
  const { cn, bg, br, rainbowSoft, vividDark } = useTwBelt()
  const color = usePrimaryColor()

  return {
    button: cn(
      'column-align-both w-10 h-11 pb-0.5 rounded border',
      `hover:${br('digest')}`,
      `hover:${bg('alphaBg2')}`,
      'trans-all-200',
      br('divider'),
      viewerHasUpvoted && cn(rainbowSoft(color)),
      vividDark(),
    ),
    //
  }
}
