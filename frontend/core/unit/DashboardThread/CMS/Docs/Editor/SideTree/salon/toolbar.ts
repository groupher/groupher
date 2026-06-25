import useTwBelt from '~/hooks/useTwBelt'

import { DOC_EDITOR_TOP_ROW, DOC_EDITOR_TOP_ROW_CONTROL } from '../../salon/layout'

export default function useSalon() {
  const { cn, fg, hover, bg, br } = useTwBelt()

  return {
    wrapper: cn('group/tree-toolbar row-center gap-1 pr-1', DOC_EDITOR_TOP_ROW),
    search: cn(
      'row-center flex-1 min-w-0 pl-0.5',
      DOC_EDITOR_TOP_ROW_CONTROL,
      'transition-colors duration-150',
      fg('hint'),
      'hover:text-neutral-800 dark:hover:text-neutral-100',
    ),
    searchIcon: cn('size-3.5 shrink-0 opacity-70'),
    searchText: cn('ml-1 text-xs truncate'),
    searchField: cn(
      'row-center h-8 min-w-0 flex-1 rounded-md border pl-2 pr-1',
      br('divider'),
      bg('card'),
      fg('hint'),
    ),
    searchInputIcon: cn('size-3.5 shrink-0 opacity-70'),
    searchInput: cn('h-6 min-w-0 border-0 bg-transparent px-2 py-0 text-xs leading-5'),
    closeSearch: cn('button-reset align-both size-6 shrink-0 rounded', hover('box')),
    closeIcon: cn('size-3 opacity-70'),
    actions: cn('row-center gap-0 shrink-0'),
    actionButton: cn('button-reset row-center justify-center h-5 w-4.5 rounded', hover('box')),
    moreButton: cn(
      'button-reset row-center justify-center h-5 w-0 rounded overflow-hidden',
      'opacity-0 pointer-events-none transition-all duration-150',
      'group-hover/tree-toolbar:w-3 group-hover/tree-toolbar:opacity-100 group-hover/tree-toolbar:pointer-events-auto',
      hover('box'),
    ),
    actionIcon: cn('size-3 smoky-65', hover('fg')),
  }
}
