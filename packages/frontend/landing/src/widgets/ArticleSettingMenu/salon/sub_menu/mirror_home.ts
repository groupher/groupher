import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('mr-0.5'),
    note: cn('text-xs mt-2.5 mb-1', fg('text.digest')),
  }
}
