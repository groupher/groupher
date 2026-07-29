import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn('column w-full border-t', br('divider')),
  }
}
