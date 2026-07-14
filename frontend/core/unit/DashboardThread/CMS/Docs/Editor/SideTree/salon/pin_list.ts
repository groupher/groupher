import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, sexyBorder } = useTwBelt()

  return {
    wrapper: 'column gap-y-2',
    list: 'column gap-y-1',
    divider: cn(sexyBorder(35), 'mt-1'),
  }
}
