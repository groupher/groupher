import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, primary } = useTwBelt()

  return {
    wrapper: 'row-center gap-2',
    control: cn(
      'group/border-control relative w-24 aspect-[71/40] overflow-hidden rounded-md border p-0 select-none outline-none trans-all-100 touch-none',
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
    svg: 'absolute inset-0 size-full',
    stick: cn(
      'stroke-current stroke-[3px] opacity-65 transition-opacity duration-100 group-hover/border-control:opacity-100',
      primary('fg'),
    ),
    handleArc: cn(
      'fill-none stroke-current stroke-[1.2px] opacity-65 transition-opacity duration-100 group-hover/border-control:opacity-100',
      primary('fg'),
    ),
    center: cn('pointer fill-current transition-colors duration-100', fg('digest')),
    centerActive: primary('fg'),
    handleMask: 'fill-card',
    handle: cn(
      'pointer fill-none stroke-current stroke-[3px] opacity-75 transition-opacity duration-100 group-hover/border-control:opacity-100',
      primary('fg'),
    ),
  }
}
