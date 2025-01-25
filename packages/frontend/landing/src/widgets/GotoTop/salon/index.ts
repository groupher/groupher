import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: cn('align-both size-8 pointer'),
    icon: cn('size-4', fill('text.digest')),
  }
}
