import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center mt-4 mb-1 -ml-0.5'),
    slash: cn('text-xs ml-1.5 mr-1.5', fg('hint')),
    cur: cn('text-xs', fg('digest')),
  }
}
