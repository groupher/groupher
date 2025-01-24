import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, primary } = useTwBelt()

  return {
    wrapper: cn('pl-36 pr-48'),
    icon: cn('size-3 mr-1', primary('fill')),
  }
}
