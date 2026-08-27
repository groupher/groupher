import useTwBelt from '~/hooks/useTwBelt'

/** Returns presentation classes for Preview review and selection. */
export default function useSalon() {
  const { cn, fg, panel, sexyBorder } = useTwBelt()

  return {
    wrapper: 'grid gap-5',
    card: panel(),
    header: 'flex items-start justify-between gap-6',
    title: cn('text-lg font-semibold text-balance', fg('title')),
    description: cn('mt-2 text-sm leading-6 text-pretty', fg('digest')),
    repoLink: cn('mt-1 block text-sm hover:underline', fg('link')),
    badge: cn('flex min-h-10 items-center gap-2 py-1 text-xs font-medium', fg('title')),
    badgeLogo: 'size-5 shrink-0 object-contain',
    infoGrid: 'mt-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm',
    infoTerm: cn('text-xs', fg('digest')),
    infoValue: cn('mt-1 truncate', fg('title')),
    countsDivider: cn(sexyBorder(), 'mt-6'),
    counts: cn('mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm tabular-nums', fg('digest')),
    countValue: cn('font-semibold', fg('title')),
    selectionBar: 'mt-5 flex min-h-10 items-center justify-between gap-4',
    selectionCount: cn('text-xs tabular-nums', fg('digest')),
    selectionActions: 'flex items-center gap-1',
    selectionError: cn('mt-2 text-xs', fg('link')),
    actions: 'mt-6 flex items-center justify-between gap-3',
  }
}
