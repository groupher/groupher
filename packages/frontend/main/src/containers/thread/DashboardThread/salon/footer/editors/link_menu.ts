import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, menu } = useTwBelt()

  return {
    wrapper: cn('column p-1.5 w-24', menu('bg')),
  }
}
