import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = { width: string } & TSpace

export default function useSalon({ width, ...spacing }: TProps) {
  const { cn, br, margin, fg, bg, primary } = useTwBelt()

  return {
    wrapper: cn('group column w-full max-w-3xl gap-3', width, margin(spacing)),
    valueLabelPrefix: fg('digest'),
    valueLabelAmount: fg('title'),
    control: 'relative grid min-h-4 items-center',
    track: 'relative h-4 pointer-events-none',
    trackPart: cn('absolute top-0 h-4 rounded-sm border'),
    trackLeft: 'left-0 rounded-l-md',
    trackRight: 'right-0 rounded-r-md',
    activeTrack: cn(primary('bg'), primary('border')),
    inactiveTrack: cn(bg('hoverBg'), br('divider')),
    indicator: cn(
      'absolute top-1/2 h-3 w-0.5 rounded-lg -translate-x-1/2 -translate-y-1/2',
      'opacity-60',
      bg('digest'),
    ),
    dot: 'absolute top-1/2 size-1 circle -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-60 group-focus-within:opacity-60',
    leftDot: 'bg-white -ml-1.5',
    rightDot: cn(primary('bg'), 'ml-1.5'),
    indicatorFocus: cn('outline outline-2 outline-offset-2', primary('border')),
    range: 'absolute inset-0 size-full m-0 opacity-0 appearance-none pointer cursor-ew-resize',
    disabled: 'opacity-50',
  }
}
