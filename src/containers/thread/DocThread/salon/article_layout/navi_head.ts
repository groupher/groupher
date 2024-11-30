import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center mt-4 mb-1'),
    slash: cn('text-xs ml-1.5 mr-1.5', fg('text.hint')),
    cur: cn('text.xs', fg('text.digest')),
  }
}
