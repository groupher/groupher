import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('fixed h-full w-full top-0 will-change-transform trans-all-200'),
  }
}
