import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, sexyVBorder } = useTwBelt()

  return {
    panelGroup: 'w-full min-h-96 mt-4.5 overflow-visible!',
    sidePanel: 'min-h-96 overflow-visible!',
    wrapper: 'column min-h-96 pr-3 overflow-visible',
    groupList: 'column gap-y-4',
    resizeHandle: cn(
      'group/docs-tree-resizer relative row-center w-3 shrink-0 pointer col-resize outline-none',
      'data-[separator=active]:cursor-col-resize',
    ),
    resizeLine: cn(
      sexyVBorder(35),
      'h-full trans-all-200',
      'group-hover/docs-tree-resizer:brightness-90',
      'group-data-[separator=active]/docs-tree-resizer:brightness-90',
      'dark:group-hover/docs-tree-resizer:brightness-110',
      'dark:group-data-[separator=active]/docs-tree-resizer:brightness-110',
    ),
    fillPanel: 'min-h-96',
  }
}
