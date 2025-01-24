import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column pl-36 w-8/12'),
  }
}
