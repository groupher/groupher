import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  treeOpen: boolean
}

export default function useSalon({ treeOpen }: TProps) {
  const { cn, hover, sexyVBorder } = useTwBelt()

  return {
    wrapper: 'relative mx-auto w-full max-w-7xl pt-6 pb-24',
    articleToc: 'absolute inset-y-0 right-0 z-10 pointer-events-none',
    articleTocSticky: 'sticky top-56 w-8 pointer-events-auto',
    mobileWrapper: 'w-full px-4 pt-6 pb-20',
    layout: 'row w-full min-w-0 items-stretch',
    sideRail: 'sticky row min-h-0 shrink-0 overflow-visible trans-all-200',
    sidePanel: 'min-h-0 shrink-0 overflow-visible',
    collapsedPanel: 'column h-full w-7 shrink-0 items-center overflow-visible',
    collapsedTreeButton: cn(
      'button-reset align-both mt-0 size-6 shrink-0 rounded-md trans-all-100 smoky-65',
      hover('bg'),
    ),
    collapsedTreeIcon: 'size-3.5',
    resizeHandle:
      'group row-center w-3 shrink-0 self-stretch cursor-col-resize touch-none select-none',
    resizeLine: cn(
      sexyVBorder(35),
      'h-full trans-all-200',
      'group-hover:brightness-90',
      'dark:group-hover:brightness-110',
    ),
    contentRail: cn('w-full min-w-0 pr-0 trans-all-200', treeOpen ? 'pl-10' : 'pl-4'),
    mobileTree: 'mb-8',
    mobileContent: 'w-full min-w-0',
  }
}
