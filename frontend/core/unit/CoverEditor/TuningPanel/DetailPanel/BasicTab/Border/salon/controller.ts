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
      'pointer fill-current opacity-65 transition-opacity duration-100 group-hover/border-control:opacity-100',
      primary('fg'),
    ),
    colorTrigger: cn(
      'block h-[3.375rem] w-3 shrink-0 overflow-hidden rounded-md p-0 leading-none outline-none trans-all-100 pointer',
      'hover:scale-x-110 hover:saturate-150 focus-visible:scale-x-110 focus-visible:saturate-150',
      'focus-visible:ring-2 focus-visible:ring-current',
    ),
    colorTriggerDisabled: 'opacity-50',
    colorPanel: cn('column w-48 gap-3.5 p-0.5'),
    colorField: 'column gap-1.5',
    colorMeta: 'row-between items-center',
    colorLabel: cn('text-xs', fg('digest')),
    colorValue: cn('text-xs tabular-nums', fg('title')),
    colorSlider: 'w-full cursor-ew-resize',
    colorSliderTrack: cn(
      'relative h-2 w-full cursor-ew-resize rounded-full overflow-visible ring-1 ring-black/10',
      'dark:brightness-75',
    ),
    colorThumb: cn(
      'absolute top-1/2 z-10 size-4 -translate-x-1/2 rounded-full border-2 border-white bg-[var(--thumb-color)] shadow-md outline-none',
      'ring-1 ring-black/15 cursor-ew-resize',
    ),
  }
}
