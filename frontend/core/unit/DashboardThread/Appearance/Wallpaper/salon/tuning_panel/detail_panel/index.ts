import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, hover } = useTwBelt()

  return {
    wrapper: 'relative column gap-4 w-full px-6 py-6',
    inner: 'grid items-start w-full min-h-32 gap-12',
    wrapperOneColumn: 'grid-cols-1',
    wrapperTwoColumns: 'grid-cols-2',
    column: 'column gap-6 w-full min-w-0',
    collapseRow: 'absolute right-5 bottom-3',
    collapseBtn: cn('text-xs px-1 py-0.5', fg('digest'), hover('bg')),
  }
}
