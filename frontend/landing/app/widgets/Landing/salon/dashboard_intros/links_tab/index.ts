import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'row s-full relative mb-16 mr-5',
      'animate-fade-up animate-duration-500 animate-ease-in-out',
    ),
  }
}
