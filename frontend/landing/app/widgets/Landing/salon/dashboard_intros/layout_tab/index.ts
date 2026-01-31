import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'row s-full relative mb-16',
      'animate-fade-up animate-duration-500 animate-ease-in-out',
    ),
  }
}
