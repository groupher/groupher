import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, hover, primary } = useTwBelt()

  return {
    focalPoint: cn(
      'relative h-12 w-24 overflow-hidden rounded-md border p-0 select-none touch-none pointer trans-all-100',
      br('divider'),
      bg('card'),
      hover('bg'),
    ),
    focalPointDisabled: 'opacity-45',
    focalPointVerticalLine: cn(
      'absolute top-0 h-full w-0 -translate-x-1/2 border-l pointer-events-none',
      br('divider'),
    ),
    focalPointHorizontalLine: cn(
      'absolute left-0 h-0 w-full -translate-y-1/2 border-t pointer-events-none',
      br('divider'),
    ),
    focalPointDot: cn(
      'absolute size-4 -translate-x-1/2 -translate-y-1/2 circle shadow-[0_0_0_7px_rgba(211,100,64,0.16),0_10px_22px_rgba(211,100,64,0.24)]',
      primary('bg'),
    ),
  }
}
