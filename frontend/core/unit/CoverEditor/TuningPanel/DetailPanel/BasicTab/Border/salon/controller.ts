import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, hover, primary } = useTwBelt()

  return {
    wrapper: 'row-center',
    control: cn(
      'relative w-24 aspect-[71/40] overflow-hidden rounded-md border p-0 select-none outline-none trans-all-100 touch-none',
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
    stick: cn('stroke-current stroke-[3px] opacity-80', primary('fg')),
    handleArc: cn('fill-none stroke-current stroke-[1.2px]', primary('fg')),
    center: cn('fill-current trans-all-100', fg('digest')),
    centerActive: primary('fg'),
    handle: cn('fill-current', primary('fg')),
  }
}
