import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, hover, primary } = useTwBelt()

  return {
    wrapper: 'column items-start w-7 py-1.5',
    openButton: cn(
      'button-reset align-both size-6 shrink-0 rounded-md trans-all-100',
      'opacity-50 mb-4',
      hover('bg'),
    ),
    openIcon: 'size-3.5',
    groupList: 'column items-start gap-y-3 pt-2 pl-1.5',
    group: 'column items-start gap-y-2',
    groupItem: 'h-0.5 w-6 rounded-sm bg-digest opacity-25',
    item: 'h-0.5 rounded-sm transition-all duration-150 ease-out hover:scale-x-125 focus-visible:outline-none',
    active: cn('w-3 opacity-80', primary('bg')),
    idle: 'w-2.5 bg-digest opacity-20 hover:opacity-70',
  }
}
