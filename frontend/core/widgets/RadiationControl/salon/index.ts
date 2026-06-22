import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, primary } = useTwBelt()

  return {
    control: cn(
      'group/radiation-control relative w-24 aspect-[71/40] overflow-hidden rounded-md border p-0 select-none touch-none outline-none trans-all-100',
      br('divider'),
      bg('card'),
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
    svg: 'abs-full-pe-none size-full',
    radiationRing: 'fill-current transition-opacity duration-100',
    radiationRingActive: cn('opacity-15', primary('fg')),
    radiationRingDisabled: cn('opacity-20', fg('digest')),
    radiusLine: cn(
      'stroke-current stroke-[3px] opacity-65 transition-opacity duration-100 group-hover/radiation-control:opacity-100',
      primary('fg'),
    ),
    handleMask: 'fill-card',
    handle: cn(
      'fill-current opacity-65 transition-opacity duration-100 group-hover/radiation-control:opacity-100',
      primary('fg'),
    ),
    centerDot: cn('fill-current transition-colors duration-100', fg('digest')),
    centerDotActive: primary('fg'),
  }
}
