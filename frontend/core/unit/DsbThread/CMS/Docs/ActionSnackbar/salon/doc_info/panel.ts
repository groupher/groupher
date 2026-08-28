import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('rounded-lg p-4', bg('card')),
    grid: 'grid grid-cols-2 gap-x-5 gap-y-5',
  }
}
