import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({
  active,
  actionVisible,
}: {
  active: boolean
  actionVisible: boolean
}) {
  const { cn, bg, fg, hover, fill, primary } = useTwBelt()

  return {
    wrapper: cn(
      'group/docs-tree-row row-center h-7 gap-x-2 rounded-md px-1 pointer',
      active && 'bold-sm',
      active && bg('hoverBg'),
      hover('box'),
    ),
    pickerSlot: 'align-both size-5 shrink-0',
    markerReadonly: 'pointer-events-none',
    titleCluster: 'row-center min-w-0 flex-1 gap-1 leading-5',
    titleButton: cn(
      'min-w-0 max-w-full text-left plain-button text-sm leading-5 truncate pointer',
      !active && `hover:${fg('title')}`,
      active ? primary('fg') : fg('digest'),
    ),
    badge: cn(
      'shrink-0 rounded px-1 py-px text-xs leading-none',
      bg('rainbow.redSoft'),
      fg('rainbow.red'),
    ),
    meta: 'row-center ml-auto h-5 shrink-0',
    publishDotSlot: cn(
      'align-both w-4 shrink-0 overflow-hidden opacity-100',
      'group-hover/docs-tree-row:w-0 group-hover/docs-tree-row:opacity-0',
      'group-focus-within/docs-tree-row:w-0 group-focus-within/docs-tree-row:opacity-0',
      actionVisible && 'w-0 opacity-0',
    ),
    unpublishedDot: cn('block size-1.5 shrink-0 rounded-full', primary('bg')),
    actions: cn(
      'row-center w-0 overflow-hidden opacity-0',
      'group-hover/docs-tree-row:w-4 group-hover/docs-tree-row:opacity-100',
      'group-focus-within/docs-tree-row:w-4 group-focus-within/docs-tree-row:opacity-100',
      actionVisible && 'w-4 opacity-100',
    ),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
  }
}
