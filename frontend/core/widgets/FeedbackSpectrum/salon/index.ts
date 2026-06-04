import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('group w-72 max-w-full column gap-2'),
    head: 'row-center gap-2',
    title: cn('text-sm bold-sm', fg('title')),
    meta: cn('text-xs', fg('hint')),
    control: 'relative h-16',
    trackWrap: 'absolute left-3 right-3 top-4 h-10',
    track: 'relative h-9 w-full overflow-visible rounded-3xl',
    trackShade: cn('absolute inset-0 rounded-3xl opacity-80 saturate-100 dark:opacity-70'),
    bucket:
      'absolute top-1/2 z-10 align-both size-4 -translate-x-1/2 -translate-y-1/2 circle text-xs bold-sm text-white select-none',
    handle: cn(
      'absolute top-1/2 z-20 size-7 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none',
    ),
    range: 'absolute inset-x-0 top-0 z-30 h-16 w-full cursor-ew-resize opacity-0',
    labels: cn('row-between text-xs', fg('hint')),
    label: 'select-none',
    footer: 'row-between gap-4',
    value: cn('row-center gap-1 text-xs', fg('digest')),
    score: cn('text-sm bold-sm', fg('title')),
    hint: cn('text-xs', fg('hint')),
    panel: 'w-72 max-w-full',
  }
}
