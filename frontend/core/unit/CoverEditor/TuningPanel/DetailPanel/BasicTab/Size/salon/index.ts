import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn } = useTwBelt()

  return {
    wrapper: 'column w-full',
    rangeRow: cn('row-center w-40'),
  }
}
