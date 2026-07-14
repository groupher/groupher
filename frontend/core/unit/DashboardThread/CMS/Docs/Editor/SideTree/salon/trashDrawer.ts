import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, hover } = useTwBelt()

  return {
    drawer: 'column h-full bg-base text-sm text-title',
    header: 'row-center-between h-14 shrink-0 border-b border-divider px-5',
    titleGroup: 'row-center gap-x-2',
    titleIcon: 'size-4 text-digest',
    title: 'text-sm font-medium text-title',
    closeButton:
      'grid size-8 place-items-center rounded-sm text-digest transition-colors hover:bg-hover',
    closeIcon: 'size-3.5',
    body: 'min-h-0 flex-1 overflow-y-auto px-4 py-3',
    empty: 'grid h-32 place-items-center text-sm text-digest',
    list: 'column gap-y-2',
    item: cn(
      'row-center min-h-14 gap-x-3 rounded-sm border border-divider bg-base px-3 py-2',
      hover('bg'),
    ),
    itemIconWrap: 'grid size-8 shrink-0 place-items-center rounded-sm bg-hover text-digest',
    itemIcon: 'size-4',
    itemMain: 'min-w-0 flex-1',
    itemTitle: 'truncate text-sm font-medium text-title',
    itemMeta: 'mt-1 truncate text-xs text-digest',
    restoreButton:
      'row-center h-10 min-w-20 shrink-0 justify-center gap-x-1.5 rounded-sm pl-2 pr-2.5 text-xs text-title transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50',
    restoreIcon: 'size-3.5',
  }
}
