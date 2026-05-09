import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon({ loading }: { loading: boolean }) {
  const { cn, bg, fg, fill, br, hover } = useTwBelt()

  const align = (colId: string) => {
    if (colId === 'title') return 'justify-start text-left'
    if (colId === 'dates' || colId === 'author') return 'justify-end text-right'
    return 'justify-center text-center'
  }

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
        'align-both shrink-0 gap-0.5 appearance-none rounded-none border-0 px-2 py-2 text-xs bold shadow-none',
        'border-r',
        br('table.border'),
        bg('pageBg'),
      ),
      canSort: cn('select-none', hover('bg')),
      multiSelectRow: 'transition-colors',
      stickyActiveBg: bg('hoverBg'),
      cell: cn('shrink-0 px-2 py-2 text-sm border-r', br('table.border')),
      root: 'min-w-full w-max border-separate border-spacing-0',
      header: cn('sticky top-0 z-10', bg('pageBg')),
      body: '',
      border: br('table.border'),
      column: (
        colId: string,
        {
          allowsSorting,
          isFocusVisible,
          sortDirection,
        }: {
          allowsSorting: boolean
          isFocusVisible: boolean
          sortDirection?: 'ascending' | 'descending'
        },
      ) =>
        cn(
          'border-r border-b px-3 py-3 text-xs bold align-middle overflow-hidden',
          br('table.border'),
          align(colId),
          colId === 'select' && 'px-0 py-0',
          allowsSorting && 'select-none cursor-pointer',
          allowsSorting && 'hover:bg-hoverBg',
          !!sortDirection && bg('hoverBg'),
          isFocusVisible && 'outline-none',
        ),
      columnInner: (colId: string) =>
        cn('flex items-center gap-1 overflow-hidden whitespace-nowrap', align(colId)),
      row: ({
        isFocusVisible,
        isHovered,
        isSelected,
      }: {
        isFocusVisible: boolean
        isHovered: boolean
        isSelected: boolean
      }) =>
        cn(
          isSelected ? bg('hoverBg') : isHovered && bg('hoverBg'),
          isFocusVisible && 'outline-none',
        ),
      cellBox: (
        colId: string,
        { isFocusVisible, isSelected }: { isFocusVisible: boolean; isSelected: boolean },
      ) =>
        cn(
          'border-r border-b px-3 py-3 text-sm align-top overflow-hidden',
          br('table.border'),
          isSelected && bg('hoverBg'),
          colId === 'select' && 'px-0 py-0 align-middle',
          isFocusVisible && 'outline-none',
        ),
      cellInner: (colId: string) =>
        cn(
          'w-full overflow-hidden',
          colId === 'status' && 'whitespace-nowrap',
          (colId === 'upvotesCount' || colId === 'views' || colId === 'commentsCount') &&
            'text-center whitespace-nowrap',
          colId === 'dates' && 'text-right whitespace-nowrap',
          colId === 'author' && 'text-right whitespace-nowrap',
        ),
      titleCell: 'flex w-full items-start gap-3 overflow-hidden',
      inlineSelection: 'shrink-0 pt-1',
      titleContent: (multiSelectMode: boolean) =>
        cn('min-w-0 flex-1 overflow-hidden', multiSelectMode && 'cursor-pointer'),
      selectionWrap: 'flex min-h-12 h-full w-full items-center justify-center',
    },
  }
}
