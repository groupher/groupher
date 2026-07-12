import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { bg, br, cn, fg, hover } = useTwBelt()

  return {
    drawer: 'column h-full',
    header: cn('row-center h-16 shrink-0 border-b px-5', br('divider')),
    titleGroup: cn('row-center min-w-0 flex-1 gap-2', fg('title')),
    titleIcon: 'bg-current',
    title: cn('truncate text-base bold-sm', fg('title')),
    closeButton: cn('align-both size-10 rounded-lg button-reset', hover('box')),
    closeIcon: cn('size-3.5', fg('digest')),
    body: 'min-h-0 flex-1 overflow-y-auto px-5 py-4',
    list: 'column gap-0.5',
    footer: cn('mt-3 border-t pt-3', br('divider')),
    addTab: 'w-full',
    bottomSavingBar: 'w-full',
    row: 'group/tab-row relative w-full',
    rowContent: cn(
      'row-center min-h-10 w-full rounded-lg transition-colors duration-150',
      `hover:${bg('hoverBg')}`,
    ),
    rowDragging: 'z-10 select-none',
    rowContentDragging: cn('shadow-sm', bg('card')),
    editingRow: 'overflow-hidden',
    dragHandle: cn(
      'plain-button absolute -left-8 top-0 align-both size-10 cursor-grab opacity-0',
      'transition-opacity duration-150 group-hover/tab-row:opacity-100 focus-visible:opacity-100',
      'active:cursor-grabbing',
      fg('hint'),
    ),
    dragIcon: 'bg-current',
    titleText: cn('min-w-0 flex-1 truncate px-2 text-sm', fg('title')),
    editInput: cn(
      'ml-2 h-8 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none',
      br('divider'),
      bg('card'),
      fg('title'),
    ),
    actions: 'row-center shrink-0',
    actionButton: cn(
      'plain-button align-both size-10 rounded-lg transition-colors duration-150',
      fg('hint'),
      hover('box'),
    ),
    deleteButton: cn(`hover:${fg('rainbow.red')}`),
    actionIcon: 'bg-current',
    editIcon: 'translate-x-1.5',
    deleteIcon: '-translate-x-1.5',
    deleteBody: 'column gap-3 px-5 pb-5 pt-2',
    deleteTitle: cn('text-lg bold-sm', fg('title')),
    deleteTabTitle: cn('truncate rounded-lg px-3 py-2 text-sm bold-sm', bg('hoverBg'), fg('title')),
    deleteDesc: cn('text-sm leading-6', fg('digest')),
    deleteActions: 'row justify-end gap-2 pt-2',
  }
}
