import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full h-full mb-20 overflow-hidden'),
  }
}
