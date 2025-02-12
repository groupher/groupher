import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    icon: cn('size-3.5 mr-1.5 opacity-80', fill('text.digest')),
  }
}
