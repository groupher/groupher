import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column items-start w-full h-full mt-10 gap-y-7'),
  }
}
