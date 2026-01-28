import useTwBelt from '~/hooks/useTwBelt'

export default ({ loading }) => {
  const { cn, bg, fg, fill, br, hover } = useTwBelt()

  return {
    wrapper: 'w-full pl-12',
    title: cn('text-sm bold-sm', fg('title')),
    cell: cn('text-sm', fg('digest')),
    icon: {
      arrowUp: 'size-2.5 rotate-90 ml-1 mt-px',
      arrowDown: 'size-2.5 -rotate-90 ml-1 mt-px',
      filter: cn('size-2.5 ml-1', fill('digest')),
    },
    table: {
      wrapper: cn(
        'relative w-full overflow-x-auto overflow-y-visible border border-b-0 border-r-0 rounded-md',
        loading && 'border-dotted border-b border-r min-h-96',
        br('table.border'),
        bg('pageBg'),
      ),
      inner: 'min-w-full w-max',
      actionBtn: cn(
        'align-both shrink-0 gap-0.5 border-r px-2 py-2 text-xs bold',
        br('table.border'),
      ),
      canSort: cn('select-none', hover('bg')),
      border: br('table.border'),
      cell: cn('shrink-0 px-2 py-2 text-sm border-r', br('table.border')),
    },
  }
}
