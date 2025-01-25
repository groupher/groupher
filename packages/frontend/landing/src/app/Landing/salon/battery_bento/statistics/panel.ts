import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('w-full h-full recursive p-4 pt-7'),
  }
}
