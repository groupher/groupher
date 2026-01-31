import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'row s-full relative -ml-16 mb-20',
      'animate-fade-up animate-duration-500 animate-ease-in-out',
    ),
  }
}
