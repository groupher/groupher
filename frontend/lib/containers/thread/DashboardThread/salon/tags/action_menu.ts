import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, menu } = useTwBelt()

  return {
    wrapper: cn('w-28 p-1', menu('bg')),
  }
}
