import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, primary, accent, fg } = useTwBelt()

  return {
    control: cn(
      'group/magnifier-control relative w-24 aspect-[71/40] overflow-hidden rounded-md border p-0 select-none touch-none outline-none trans-all-100',
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
    svg: 'absolute inset-0 size-full pointer-events-none',
    lensRing: 'fill-current stroke-current transition-opacity duration-100',
    lensRingActive: cn('opacity-20 stroke-[1.5px]', primary('fg')),
    lensRingDisabled: cn('opacity-20 stroke-[1.5px]', fg('digest')),
    lensGlass: 'fill-white opacity-20',
    radiusLine: cn(
      'stroke-current stroke-[3px] opacity-70 transition-opacity duration-100 group-hover/magnifier-control:opacity-100',
      primary('fg'),
    ),
    zoomLine: cn(
      'stroke-current stroke-[3px] opacity-70 transition-opacity duration-100 group-hover/magnifier-control:opacity-100',
      accent('fg'),
    ),
    handleMask: 'fill-card',
    radiusHandle: cn(
      'fill-none stroke-current stroke-[3px] opacity-75 transition-opacity duration-100 group-hover/magnifier-control:opacity-100',
      primary('fg'),
    ),
    zoomHandle: cn(
      'fill-none stroke-current stroke-[3px] opacity-75 transition-opacity duration-100 group-hover/magnifier-control:opacity-100',
      accent('fg'),
    ),
    centerDot: cn('fill-current transition-colors duration-100', fg('digest')),
    centerDotActive: primary('fg'),
    centerCheck: 'pointer-events-none fill-white',
  }
}
