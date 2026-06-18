import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn('py-1 border-t', br('divider')),
  }
}
