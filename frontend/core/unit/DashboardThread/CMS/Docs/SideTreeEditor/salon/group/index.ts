import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon({ actionVisible }: { actionVisible: boolean }) {
  const { cn, fg, fill } = useTwBelt()

  const icon = cn('size-3.5 pointer trans-all-100', fill('digest'))

  return {
    wrapper: 'column group/docs-tree-group',
    head: 'row-center h-7',
    titleButton: cn('row-center min-w-0 bg-transparent border-0 p-0 text-left', fg('digest')),
    arrowIcon: cn('size-3 ml-1.5 -rotate-90 trans-all-100', fill('digest')),
    arrowCollapsed: 'rotate-180',
    title: cn('truncate text-sm pointer', `hover:${fg('title')}`),
    actions: cn(
      'row-center ml-auto gap-x-1 opacity-0 group-hover/docs-tree-group:opacity-100 trans-all-100',
      actionVisible && 'opacity-100',
    ),
    actionIcon: icon,
    children: 'column gap-y-1.5 mt-2',
    collapsed: 'hidden',
  }
}
