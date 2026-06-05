import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, primary } = useTwBelt()

  return {
    wrapper: 'column w-full',
    control: cn(
      'relative w-24 aspect-[71/40] overflow-hidden rounded-md border p-0 select-none touch-none pointer',
      br('divider'),
      bg('card'),
    ),
    verticalLine: cn(
      'absolute top-0 h-full w-0 -translate-x-1/2 border-l pointer-events-none',
      br('divider'),
    ),
    horizontalLine: cn(
      'absolute left-0 h-0 w-full -translate-y-1/2 border-t pointer-events-none',
      br('divider'),
    ),
    frameBlock: cn('absolute rounded-sm pointer-events-none opacity-85', primary('bg')),
  }
}
