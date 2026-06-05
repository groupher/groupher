import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, hover, primary } = useTwBelt()

  return {
    control: cn(
      'relative h-12 w-24 overflow-hidden rounded-md border p-0 select-none touch-none outline-none trans-all-100',
      br('divider'),
      bg('card'),
      hover('bg'),
      `focus-visible:${primary('border')}`,
    ),
    controlActive: primary('border'),
    verticalLine: cn(
      'absolute top-0 h-full w-0 -translate-x-1/2 border-l pointer-events-none',
      br('divider'),
    ),
    horizontalLine: cn(
      'absolute left-0 h-0 w-full -translate-y-1/2 border-t pointer-events-none',
      br('divider'),
    ),
    svg: 'absolute inset-0 size-full pointer-events-none',
    radiationRing: 'fill-current trans-all-100',
    radiationRingActive: cn('opacity-15', primary('fg')),
    radiationRingDisabled: cn('opacity-20', fg('digest')),
    radiusLine: cn('stroke-current stroke-[3px] opacity-75', primary('fg')),
    handle: cn('fill-current', primary('fg')),
    centerDot: cn('fill-current trans-all-100', fg('digest')),
    centerDotActive: primary('fg'),
  }
}
