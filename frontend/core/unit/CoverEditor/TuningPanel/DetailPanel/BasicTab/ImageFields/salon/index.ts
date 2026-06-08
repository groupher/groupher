import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    quickControls: 'row-center justify-between w-full gap-4 pt-1 pb-5',
    quickItem: 'group/quick-item column items-center gap-2 min-w-0',
    quickControl: 'align-both h-16',
    quickLabelRow: 'relative row-center min-h-5',
    quickLabel: cn('text-sm leading-none', fg('digest')),
    quickAction:
      'absolute left-full top-1/2 ml-1 -translate-y-1/2 opacity-0 trans-all-100 group-hover/quick-item:opacity-100 group-focus-within/quick-item:opacity-100',
  }
}
