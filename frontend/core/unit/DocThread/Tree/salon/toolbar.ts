import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, bg, hover } = useTwBelt()

  return {
    wrapper: 'group/tree-toolbar row-center h-7 -mt-0.5 mb-2 w-full',
    search: cn(
      'row-center h-6 min-w-0 flex-1 pl-0.5 pointer transition-colors duration-150',
      fg('hint'),
      'hover:text-neutral-800 dark:hover:text-neutral-100',
    ),
    searchIcon: 'size-3.5 shrink-0 opacity-70',
    searchText: 'ml-1 truncate text-xs',
    searchField: cn(
      'row-center h-8 min-w-0 flex-1 rounded-md border pl-2 pr-1',
      br('divider'),
      bg('card'),
      fg('hint'),
    ),
    searchInputIcon: 'size-3.5 shrink-0 opacity-70',
    searchInput: 'h-6 min-w-0 border-0 bg-transparent px-2 py-0 text-xs leading-5',
    closeSearch: cn('button-reset align-both size-6 shrink-0 rounded', hover('box')),
    closeIcon: 'size-3 opacity-80',
  }
}
