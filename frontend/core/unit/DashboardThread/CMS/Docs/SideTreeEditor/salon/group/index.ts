import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ actionVisible }: { actionVisible: boolean }) {
  const { cn, fg, fill, primary } = useTwBelt()

  const icon = cn('size-3.5 pointer trans-all-100', fill('digest'))

  return {
    wrapper: 'column group/docs-tree-group border-b border-transparent',
    wrapperTarget: cn(primary('border')),
    head: 'row-center relative -ml-7 h-7 w-[calc(100%+1.75rem)] pl-7',
    dragHandle: cn(
      'row-center absolute left-1 top-1/2 size-5 -translate-y-1/2 cursor-grab border-0 bg-transparent p-0 opacity-0 trans-all-100',
      'group-hover/docs-tree-group:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
      fill('digest'),
    ),
    dragIcon: 'size-3.5',
    titleButton: cn('row-center min-w-0 bg-transparent border-0 p-0 text-left', fg('digest')),
    arrowIcon: cn('size-3 ml-1.5 -rotate-90 trans-all-100', fill('digest')),
    arrowCollapsed: 'rotate-180',
    title: cn('truncate text-sm pointer', `hover:${fg('title')}`),
    actions: cn(
      'row-center ml-auto gap-x-1 opacity-0 group-hover/docs-tree-group:opacity-100 group-focus-within/docs-tree-group:opacity-100 trans-all-100',
      actionVisible && 'opacity-100',
    ),
    actionIcon: icon,
    children: 'column gap-y-1.5 mt-2 min-h-3 border-b border-transparent',
    collapsed: 'hidden',
  }
}
