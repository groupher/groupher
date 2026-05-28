import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, hover } = useTwBelt()

  return {
    wrapper: 'relative column gap-4 w-full px-6 py-6',
    inner: 'grid items-start w-full min-h-32 gap-12',
    wrapperOneColumn: 'grid-cols-1',
    wrapperTwoColumns: 'grid-cols-2',
    effects: 'column gap-5 w-full',
    topControls: 'row-center justify-between pr-2 mb-1',
    toggleRows: 'column gap-3',
    rightPanel: 'column gap-5 w-full min-w-0',
    angleFields: 'align-both -mt-2',
    title: cn('text-sm bold-sm mb-4', fg('digest')),
    switchWrapper: 'flex items-center h-5 gap-3',
    toggleTitle: cn('w-20 shrink-0 text-sm leading-none', fg('digest')),
    rangeRows: 'column gap-4.5 min-w-0',
    customFields: 'w-full min-w-0',
    collapseRow: 'absolute right-5 bottom-3',
    collapseBtn: cn('text-xs px-1 py-0.5', fg('digest'), hover('bg')),
  }
}
