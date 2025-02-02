import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  viewerHasUpvoted: boolean
}

export default ({ viewerHasUpvoted }: TProps) => {
  const { cn, fg, fill, primary } = useTwBelt()

  return {
    wrapper: cn('text-sm border-none', fg('text.title')),
    inner: 'align-both w-4 h-4',
    upIcon: cn('size-4 opacity-65', viewerHasUpvoted ? primary('fill') : fill('text.digest')),
  }
}
