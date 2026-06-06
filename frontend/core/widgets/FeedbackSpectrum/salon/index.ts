import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('group w-56 max-w-full column'),
    head: 'row-center',
    title: cn('text-sm mb-2', fg('digest')),
    meta: cn('text-xs', fg('hint')),
    control: 'relative h-9',
    trackWrap: 'absolute left-0 right-0 h-9',
    track: 'relative h-8 w-full overflow-visible rounded-3xl',
    trackShade: cn('absolute inset-0 rounded-3xl opacity-80 saturate-100 dark:opacity-70'),
    glowClip: 'absolute inset-0 overflow-hidden rounded-3xl pointer-events-none',
    handleGlow:
      'absolute top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 circle opacity-75 blur-md',
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
