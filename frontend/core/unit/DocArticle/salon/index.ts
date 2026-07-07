import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('mx-auto w-full max-w-3xl pt-12 pb-24'),
  }
}
