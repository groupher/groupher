import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'row w-full h-full relative mb-20',
      'animate-fade-up animate-duration-500 animate-ease-in-out',
    ),
  }
}
