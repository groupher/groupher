import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'row s-full relative mb-24',
      'animate-fade-up animate-duration-500 animate-ease-in-out',
    ),
  }
}
