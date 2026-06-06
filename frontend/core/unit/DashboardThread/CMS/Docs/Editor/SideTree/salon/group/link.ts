import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({
  active,
  actionVisible,
}: {
  active: boolean
  actionVisible: boolean
}) {
  const { cn, fg, fill, primary } = useTwBelt()

  return {
    wrapper: cn('group/docs-tree-row row-center h-7 gap-x-2 rounded-md', active && 'bold-sm'),
    pickerSlot: 'row-center size-4 shrink-0',
    titleButton: cn(
      'min-w-0 max-w-28 text-left bg-transparent border-0 p-0 text-sm truncate',
      active ? primary('fg') : fg('digest'),
    ),
    href: cn('max-w-16 truncate text-xs', fg('hint')),
    actions: cn(
      'row-center ml-auto opacity-0 group-hover/docs-tree-row:opacity-100 group-focus-within/docs-tree-row:opacity-100 trans-all-100',
      actionVisible && 'opacity-100',
    ),
    moreIcon: cn('size-3.5 pointer', fill('digest')),
  }
}
