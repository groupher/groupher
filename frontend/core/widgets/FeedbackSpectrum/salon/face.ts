import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn(
      'absolute top-1/2 z-20 size-7 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none',
    ),
  }
}
