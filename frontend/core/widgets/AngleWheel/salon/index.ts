import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg, primary } = useTwBelt()

  return {
    wrapper: cn('relative size-14 circle border select-none touch-none pointer', br('divider')),
    guide: 'absolute inset-0 size-full overflow-visible pointer-events-none',
    guideArc: cn('fill-none stroke-current stroke-[1px]', primary('fg')),
    center: cn(
      'align-both absolute inset-0 m-0 border-0 bg-transparent p-0 text-xs tabular-nums pointer outline-none',
      fg('digest'),
    ),
    point: cn('absolute size-2.5 circle shadow-sm', primary('bg')),
  }
}
