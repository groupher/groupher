import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('column mb-4 -mt-1'),
    title: cn('text-sm mb-2.5', fg('text.digest')),
  }
}
