import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'row-center mb-2.5',
    totalCount: 'grow',
    totalTitle: cn('row items-end text-base bold-sm', fg('title')),
    totalNum: cn('text-sm ml-1.5 opacity-80', fg('digest')),
    actions: 'row-center',
    editIcon: cn('size-3 mr-1', fill('button.fg')),
  }
}
