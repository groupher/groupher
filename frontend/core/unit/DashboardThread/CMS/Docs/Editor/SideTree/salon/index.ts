export { cn } from '~/css'

import useTwBelt from '~/hooks/useTwBelt'

import { SIDE_TREE_SPACING } from './constant'

export const SIDE_TREE_CLASS = {
  viewport:
    'column min-h-0 flex-1 w-[calc(100%+2.625rem)] overflow-x-hidden overflow-y-auto overscroll-y-auto',
  topLevelGroupList: 'column min-h-3',

  group: {
    wrapper: 'column group/docs-tree-group border-b border-transparent',
    header: 'group/docs-tree-head @container row-center relative h-7 pr-1',
    topLevelHeaderWidth: 'w-[calc(100%+1.75rem)]',
    nestedHeaderWidth: 'w-full',
    children: 'column min-h-3 border-b border-transparent',
  },

  leaf: {
    list: 'column',
    populatedList: 'min-h-2.5',
    emptyList: 'min-h-0',
    row: 'group row-center h-7 rounded-md px-1',
    markerSlot: 'align-both size-5 shrink-0',
    sortable: 'group/docs-tree-sortable-child relative rounded-md will-change-transform',
    topLevelWidth: 'w-[calc(100%+1.75rem)]',
    nestedWidth: 'w-full',
  },

  dragHandle: {
    base: 'align-both absolute top-1/2 z-10 size-5 -translate-y-1/2 cursor-grab plain-button opacity-0 trans-all-100',
    topLevel: 'left-1',
    nested: '-left-4',
  },

  groupDropIndicator: {
    before: 'absolute -top-1 left-0 right-0 h-px',
    after: 'absolute -bottom-1 left-0 right-0 h-px',
  },

  leafDropIndicator: {
    before: 'absolute -top-1 right-0 h-px',
    after: 'absolute -bottom-1 right-0 h-px',
    topLevel: 'left-7',
    nested: 'left-2.5',
  },
} as const

export default function useSalon() {
  const { cn, scrollbar } = useTwBelt()

  return {
    wrapper: 'sticky @container column h-full max-h-full min-h-0 pr-2 overflow-visible',
    groupList: cn(
      SIDE_TREE_CLASS.viewport,
      SIDE_TREE_SPACING.VIEWPORT_GUTTER,
      SIDE_TREE_SPACING.TREE_SECTION_GAP,
      scrollbar('thin'),
    ),
    empty: 'px-1 pt-2 text-xs text-digest',
  }
}
