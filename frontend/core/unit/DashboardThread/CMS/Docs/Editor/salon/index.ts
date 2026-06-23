import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, sexyVBorder } = useTwBelt()

  return {
    wrapper: 'relative w-full min-w-0 overflow-visible!',
    surface: 'grid min-h-screen w-full min-w-0 overflow-visible!',
    panelGroup: 'col-start-1 row-start-1 w-full min-w-0 min-h-96 overflow-visible!',
    snackbarRail:
      'pointer-events-none sticky col-start-1 row-start-1 z-30 flex h-12 w-full items-center justify-center',
    sidePanel: 'min-h-96 overflow-visible!',
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
    fillPanel: 'min-w-0 min-h-96',
  }
}
