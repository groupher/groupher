import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: 'column w-full',
    items: 'column gap-3 w-full',
    rangeRow: cn('row-center w-40'),
  }
}
