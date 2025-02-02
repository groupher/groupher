import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('row-center-between w-full mt-5 mb-5 pl-5 pr-9'),
  }
}
