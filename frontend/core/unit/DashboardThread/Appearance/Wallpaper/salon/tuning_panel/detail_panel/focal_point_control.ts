import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, hover, primary } = useTwBelt()

  return {
    focalPoint: cn(
      'relative h-12 w-24 overflow-hidden rounded-md border p-0 bg-transparent select-none touch-none pointer',
      br('divider'),
      hover('bg'),
    ),
    focalPointVerticalLine: cn(
      'absolute top-0 h-full w-0 -translate-x-1/2 border-l pointer-events-none',
      br('divider'),
    ),
    focalPointHorizontalLine: cn(
      'absolute left-0 h-0 w-full -translate-y-1/2 border-t pointer-events-none',
      br('divider'),
    ),
    focalPointDot: cn(
      'absolute size-3 -translate-x-1/2 -translate-y-1/2 circle shadow-sm',
      primary('bg'),
    ),
  }
}
