import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, primary } = useTwBelt()

  return {
    icon: cn('size-3 mr-1', primary('fill')),
  }
}
