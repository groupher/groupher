import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ actionVisible }: { actionVisible: boolean }) {
  const { cn, fg, fill, primary } = useTwBelt()

  const icon = cn('size-3.5 pointer', fill('digest'))

  return {
    wrapper: 'column group/docs-tree-group border-b border-transparent -mt-0.5',
    wrapperTarget: primary('border'),
    head: 'group/docs-tree-head row-center relative h-7 -ml-7 w-[calc(100%+1.75rem)] pl-8 pr-1',
    dragHandle: cn(
      'row-center absolute left-1 top-1/2 z-10 size-5 -translate-y-1/2 cursor-grab plain-button opacity-0 trans-all-100',
      'group-hover/docs-tree-head:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
      actionVisible && 'opacity-100',
      fill('digest'),
    ),
    dragIcon: 'size-3.5',
    titleButton: cn('row-center min-w-0 plain-button text-left leading-5', fg('digest')),
    arrowIcon: cn('size-3 ml-1.5 -rotate-90 trans-all-100', fill('digest')),
    arrowCollapsed: 'rotate-180',
    title: cn('truncate text-sm pointer smoky-65', `hover:${fg('title')}`),
    actionSlot: 'row-center relative ml-auto h-5 w-12 shrink-0 justify-end',
    coverStatus: cn(
      'align-both absolute right-0 top-1/2 size-4 -translate-y-1/2 pointer-events-none opacity-100',
      'group-hover/docs-tree-head:opacity-0',
      'group-focus-within/docs-tree-head:opacity-0',
      actionVisible && 'opacity-0',
    ),
    coverStatusIcon: cn(icon, 'opacity-50'),
    addButton: cn(
      'align-both size-5 plain-button opacity-0 trans-all-100',
      'group-hover/docs-tree-head:opacity-100',
      'group-focus-within/docs-tree-head:opacity-100',
      actionVisible && 'opacity-100',
    ),
    actions: cn(
      'row-center size-5 opacity-0 trans-all-100',
      'group-hover/docs-tree-head:opacity-100',
      'group-focus-within/docs-tree-head:opacity-100',
      actionVisible && 'opacity-100',
    ),
    actionIcon: icon,
    children: 'column gap-y-1.5 mt-2 min-h-3 border-b border-transparent',
    collapsed: 'hidden',
  }
}
