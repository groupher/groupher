import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('px-1.5 animate-fade-left animate-duration-200'),
  }
}
