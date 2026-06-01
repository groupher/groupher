import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({
  active,
  actionVisible,
}: {
  active: boolean
  actionVisible: boolean
}) {
  const { cn, bg, fg, fill, primary } = useTwBelt()

  return {
    wrapper: cn('group/docs-tree-row row-center h-7 gap-x-2', active && 'bold-sm'),
    pickerSlot: 'row-center size-4 shrink-0',
    titleButton: cn(
      'min-w-0 max-w-28 text-left bg-transparent border-0 p-0 text-sm truncate pointer',
      !active && `hover:${fg('title')}`,
      active ? primary('fg') : fg('digest'),
    ),
    badge: cn(
      'shrink-0 rounded px-1 py-px text-xs leading-none',
      bg('rainbow.redSoft'),
      fg('rainbow.red'),
    ),
    actions: cn(
      'row-center ml-auto opacity-0 group-hover/docs-tree-row:opacity-100 trans-all-100',
      actionVisible && 'opacity-100',
    ),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
  }
}
