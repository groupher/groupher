import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, bg, hover } = useTwBelt()

  return {
    searchButton: cn(
      'row-center h-6 min-w-0 flex-1 pointer transition-colors duration-150',
      fg('hint'),
      'hover:text-neutral-800 dark:hover:text-neutral-100',
    ),
    searchIcon: 'size-3.5 shrink-0 opacity-70',
    searchText: 'ml-1 truncate text-xs',
    field: cn(
      'row-center h-8 min-w-0 flex-1 rounded-md border pl-2 pr-1',
      br('divider'),
      bg('card'),
      fg('hint'),
    ),
    inputIcon: 'size-3.5 shrink-0 opacity-70',
    inputWidth: 'w-full',
    input: 'h-6 min-w-0 border-0 bg-transparent px-2 py-0 text-xs leading-5',
    closeButton: cn('button-reset align-both size-6 shrink-0 rounded', hover('box')),
    closeIcon: 'size-3 opacity-80',
  }
}
