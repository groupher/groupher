import useTwBelt from '~/hooks/useTwBelt'

/** Returns layout and state presentation classes for the shared process log. */
export default function useSalon() {
  const { cn, br, fg, sexyBorder } = useTwBelt()

  return {
    wrapper: 'w-full text-left',
    divider: sexyBorder(),
    bottomDivider: cn(sexyBorder(), 'mb-4'),
    content: 'px-4 py-5 opacity-80',
    stageLive: 'sr-only',
    steps: 'space-y-5',
    progress: cn('mt-5 row-center justify-between border-t pt-3', br('divider')),
    progressLabel: cn('text-xs', fg('digest')),
    progressCount: cn('text-sm font-medium tabular-nums', fg('title')),
    disconnected: cn('mt-4 border-t pt-3 text-xs text-pretty', br('divider'), fg('digest')),
  }
}
