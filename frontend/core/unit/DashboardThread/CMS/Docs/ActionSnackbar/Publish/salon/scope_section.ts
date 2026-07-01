import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, hover, primary } = useTwBelt()

  return {
    section: 'column gap-1.5',
    heading: cn('row-center gap-1 px-2 pb-1 text-xs bold-sm', fg('title')),
    count: cn('text-xs', fg('digest')),
    empty: cn('px-2 py-1 text-xs', fg('digest')),
    item: cn(
      'grid grid-cols-[18px_minmax(0,1fr)] gap-2 w-full rounded-md px-2 py-2 text-left cursor-pointer',
      hover('box'),
    ),
    checkbox: cn('mt-0.5 size-3.5 accent-current', primary('fg')),
    text: 'row-center min-w-0 gap-2',
    title: cn('min-w-0 flex-1 truncate text-xs bold-sm', fg('title')),
    desc: cn('shrink-0 text-xs', fg('digest')),
  }
}
