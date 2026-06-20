import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg, fg, primary } = useTwBelt()

  return {
    wrapper: cn(
      'group/angle relative size-12 circle border select-none touch-none pointer',
      br('divider'),
      bg('card'),
    ),
    guide: 'abs-full size-full overflow-visible pointer-events-none',
    ticks: (active: boolean) =>
      cn(
        'opacity-0 transition-opacity duration-150 ease-out group-hover/angle:opacity-100 group-focus-within/angle:opacity-100',
        active && 'opacity-100',
      ),
    tick: cn('stroke-current stroke-[0.8px] opacity-25', fg('hint')),
    majorTick: cn('stroke-current stroke-[1px] opacity-45', fg('digest')),
    guideArc: cn('fill-none stroke-current stroke-[1px]', primary('fg')),
    center: cn(
      'align-both abs-full m-0 plain-button text-xs leading-none tabular-nums pointer outline-none',
      fg('digest'),
    ),
    negativeSign: 'mb-px text-[10px] leading-none opacity-60',
    point: cn('absolute size-2 circle shadow-sm', primary('bg')),
  }
}
