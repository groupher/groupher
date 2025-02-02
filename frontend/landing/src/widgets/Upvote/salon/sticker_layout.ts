import usePrimaryColor from '~/hooks/usePrimaryColor'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  viewerHasUpvoted: boolean
}

export default ({ viewerHasUpvoted }: TProps) => {
  const { cn, br, bg, rainbowSoft } = useTwBelt()
  const color = usePrimaryColor()

  return {
    wrapper: 'column-align-both -ml-2',
    button: cn(
      'column-align-both rounded-lg w-10 h-11 mb-2 border',
      `hover:${br('text.digest')}`,
      `hover:${bg('alphaBg2')}`,
      'trans-all-200',
      br('divider'),
      viewerHasUpvoted && cn(rainbowSoft(color)),
    ),
  }
}
