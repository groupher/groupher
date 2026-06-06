import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    quickControls: 'row-center justify-between w-full gap-4 pt-1 pb-5',
    quickItem: 'column items-center gap-2 min-w-0',
    quickControl: 'align-both h-16',
    quickLabel: cn('text-sm leading-none', fg('digest')),
    fineSettings: 'grid grid-cols-2 gap-x-12 w-full pt-1',
    fineColumn: 'column gap-5 min-w-0',
  }
}
