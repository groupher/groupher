import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('px-3 py-4 text-sm', fg('text.digest')),
  }
}
