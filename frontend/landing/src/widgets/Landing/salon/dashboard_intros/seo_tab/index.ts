import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'row w-full h-5/6 mt-14 relative',
      'animate-fade-up animate-duration-500 animate-ease-in-out',
    ),
  }
}
