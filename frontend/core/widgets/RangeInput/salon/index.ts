import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = { width: string; labelPlacement: 'top' | 'left'; hideLabel: boolean } & TSpace

export default function useSalon({ width, labelPlacement, hideLabel, ...spacing }: TProps) {
  const { cn, br, margin, fg, bg, primary } = useTwBelt()
  const hasLeftLabel = labelPlacement === 'left' && !hideLabel

  return {
    wrapper: cn(
      'group w-full max-w-3xl gap-3',
      hasLeftLabel ? 'flex items-center' : 'column',
      width,
      margin(spacing),
    ),
    valueLabel: cn(
      'row-center justify-start gap-1 text-sm leading-none',
      hideLabel && 'sr-only',
      hasLeftLabel && 'w-20 shrink-0',
      !hideLabel &&
        !hasLeftLabel &&
        'opacity-0 translate-y-1 pointer-events-none transition-all delay-1000 duration-200 ease-out group-hover:delay-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-within:delay-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto',
    ),
    valueLabelPrefix: fg('digest'),
    valueLabelAmount: fg('title'),
    control: 'relative grid min-h-4 flex-1 items-center',
    track: 'relative z-10 h-4 pointer-events-none',
    trackPart: cn(
      'absolute top-0 h-4 rounded-sm border origin-center scale-y-50 transition-transform delay-1000 duration-200 ease-out group-hover:delay-100 group-hover:scale-y-100 group-focus-within:delay-0 group-focus-within:scale-y-100',
    ),
    trackLeft: 'left-0 rounded-l-md',
    trackRight: 'right-0 rounded-r-md',
    activeTrack: cn(primary('bg'), primary('border')),
    inactiveTrack: cn(bg('hoverBg'), br('divider')),
    indicatorHitbox:
      'group/indicator absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center pointer-events-auto cursor-ew-resize',
    indicator: cn(
      'h-3 w-0.5 rounded-lg opacity-50 origin-center scale-y-50 transition-[opacity,transform] delay-1000 duration-200 ease-out group-hover:delay-100 group-hover:scale-y-100 group-focus-within:delay-0 group-focus-within:scale-y-100 group-hover/indicator:opacity-100',
      bg('digest'),
    ),
    dot: 'absolute top-1/2 w-0.5 h-2 circle -translate-x-1/2 -translate-y-1/2 origin-center scale-y-50 transition-transform delay-1000 duration-200 ease-out group-smoky-0 group-hover:delay-100 group-hover:scale-y-100 group-focus-within:delay-0 group-focus-within:scale-y-100',
    leftDot: 'bg-white -ml-1',
    rightDot: cn(primary('bg'), 'ml-1'),
    indicatorFocus: cn('outline-2 outline-offset-2', primary('border')),
    range: 'absolute inset-0 size-full m-0 opacity-0 appearance-none pointer cursor-ew-resize',
    disabled: 'opacity-50',
  }
}
