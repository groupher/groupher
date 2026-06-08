import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, bg, fill, hover, primary } = useTwBelt()

  return {
    wrapper: 'row-center justify-between gap-2 w-full h-11 px-4 py-1 overflow-hidden',
    hudItems: 'row-center justify-start gap-3 min-w-0 overflow-hidden',
    item: 'row-center h-7 min-w-7 shrink-0 gap-1 group/hud-item',
    iconBox: 'align-both size-5 opacity-70 trans-all-100 group-hover/hud-item:opacity-100',
    iconBoxActive: 'opacity-100',
    icon: cn('size-4 trans-all-100', fill('title')),
    value: cn('max-w-12 truncate text-xs font-medium leading-none', fg('digest')),
    coverIcon: cn('relative h-3 w-5 overflow-hidden rounded-sm border', br('divider')),
    coverIconFrame: cn(
      'absolute rounded-[1px] border -translate-x-1/2 -translate-y-1/2 opacity-80',
      primary('bg'),
      primary('border'),
    ),
    magnifierDot: cn(
      'absolute size-2 -translate-x-1/2 -translate-y-1/2 circle border border-white/70',
      bg('divider'),
    ),
    gridDotActive: primary('bg'),
    bgSwatch: cn('size-5 rounded-sm', bg('hoverBg')),
    expandBtn: cn('align-both size-6 shrink-0 rounded-md', hover('bg')),
    expandIcon: cn('size-3 -rotate-90', fg('digest')),
  }
}
