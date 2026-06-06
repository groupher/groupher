import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, primary } = useTwBelt()

  return {
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
    frameBlock: 'group/frame absolute rounded-sm pointer-events-auto',
    frameFill: cn('absolute inset-0 rounded-sm pointer-events-none opacity-85', primary('bg')),
    dragIcon:
      'pointer-events-none absolute left-1/2 top-1/2 z-10 size-6 -translate-x-1/2 -translate-y-1/2 fill-white transition-opacity duration-100',
    dragIconIdle: 'opacity-30 group-hover/frame:opacity-50',
    dragIconDragging: 'opacity-50',
  }
}
