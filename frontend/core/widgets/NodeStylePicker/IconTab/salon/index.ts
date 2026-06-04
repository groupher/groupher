import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn, fg, fill, hover, primary } = useTwBelt()

  return {
    wrapper: 'flex h-full min-h-0 flex-col',
    listWrapper: 'min-h-0 flex-1',
    searchWrapper: cn('px-2 pt-2 pb-1'),
    searchBox: (focused: boolean) =>
      cn(
        'row-center rounded-md border px-2.5 h-8 trans-all-100',
        bg('card'),
        focused ? primary('border') : br('divider'),
      ),
    searchIcon: cn('size-3.5 mr-2 shrink-0', fill('digest')),
    searchInput: cn(
      'w-full bg-transparent text-sm placeholder:text-sm outline-none',
      fg('title'),
      '[&::placeholder]:text-digest',
      '[&::-webkit-search-cancel-button]:hidden',
      '[&::-webkit-search-decoration]:hidden',
    ),
    clearButton: cn('shrink-0 ml-2 pointer', fill('digest')),
    clearIcon: 'size-3.5',
    emptyState: cn('align-both h-full text-sm', fg('digest')),
    viewport: 'min-w-0 h-full overflow-x-hidden overflow-y-scroll overscroll-contain',
    devViewport: 'min-w-0 h-full overflow-x-hidden overflow-y-scroll overscroll-contain',
    gridRow: 'grid px-1',
    cell: cn(
      'align-both group flex h-10 min-w-0 rounded border border-transparent p-0.5 appearance-none transition-all duration-150',
      hover('box'),
    ),
    devCell: cn(
      'align-both group flex h-10 min-w-0 rounded border border-transparent p-0.5 appearance-none transition-all duration-150',
      hover('box'),
    ),
    cellActive: primary('border'),
    // Provider sprite icons read color from currentColor.
    iconColor: fg('digest'),
    iconColorActive: primary('fg'),
  }
}
