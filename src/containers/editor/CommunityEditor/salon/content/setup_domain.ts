import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('column-align-center w-full rounded-md mt-5 mb-16'),
  }
}
