import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: cn('column w-48 min-h-96 pr-3 mt-4.5 border-r', br('divider')),
    list: 'column gap-y-4',
    addSlot: 'mt-4',
  }
}
