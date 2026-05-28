import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg, fg, primary, hover } = useTwBelt()

  return {
    wrapper:
      'row-center justify-between px-3 py-3 w-full min-h-6 gap-3 rounded-md text-left trans-all-200',
    hudItems: 'flex items-center flex-wrap gap-x-4 gap-y-2 min-w-0',
    hudItem: 'row-center gap-1.5 min-w-0 whitespace-nowrap',
    hudLabel: cn('text-xs leading-none', fg('digest')),
    hudValue: cn('text-sm bold-sm leading-none tabular-nums', fg('title')),
    hudSwatchWrap: 'row-center gap-1.5',
    hudPatternSwatch: cn('size-5 circle border shadow-sm shrink-0', br('divider'), bg('card')),
    hudAngle: 'row-center gap-1.5',
    hudAngleRing: cn('relative size-5 circle border shrink-0', br('divider')),
    hudAngleDot: cn(
      'absolute left-1/2 top-0 size-1.5 -ml-0.75 -mt-0.75 circle origin-[3px_10px]',
      primary('bg'),
    ),
    expandBtn: cn('size-6 shrink-0', hover('bg')),
    expandIcon: cn('size-3 shrink-0 -rotate-90', fg('digest')),
  }
}
