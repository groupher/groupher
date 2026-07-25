import useTwBelt from '~/hooks/useTwBelt'

import { SIDE_TREE_CLASS } from '..'
import { SIDE_TREE_SPACING } from '../constant'

export { cn } from '~/css'

export default function useSalon({
  actionVisible,
  coverStatusVisible,
  nestedWithinGroup,
  topLevel,
}: {
  actionVisible: boolean
  coverStatusVisible: boolean
  nestedWithinGroup: boolean
  topLevel: boolean
}) {
  const { cn, fg, fill, hover, primary } = useTwBelt()

  const icon = cn('size-3.5 pointer', fill('digest'))
  const fgIcon = cn('size-3 pointer', fg('digest'))

  return {
    wrapper: cn(
      SIDE_TREE_CLASS.group.wrapper,
      topLevel && SIDE_TREE_SPACING.TOP_LEVEL_GROUP_MARGIN_TOP,
      nestedWithinGroup && SIDE_TREE_SPACING.NESTED_GROUP_LEVEL_MARGIN_LEFT,
    ),
    wrapperCollapsed: topLevel ? SIDE_TREE_SPACING.TOP_LEVEL_GROUP_COLLAPSED_MARGIN_BOTTOM : '',
    wrapperTarget: primary('border'),
    head: cn(
      SIDE_TREE_CLASS.group.header,
      topLevel
        ? cn(
            SIDE_TREE_CLASS.group.topLevelHeaderWidth,
            SIDE_TREE_SPACING.TOP_LEVEL_GROUP_HEADER_GUTTER,
          )
        : cn(SIDE_TREE_CLASS.group.nestedHeaderWidth, SIDE_TREE_SPACING.NESTED_GROUP_HEADER_INDENT),
    ),
    dragHandle: cn(
      SIDE_TREE_CLASS.dragHandle.base,
      topLevel ? SIDE_TREE_CLASS.dragHandle.topLevel : SIDE_TREE_CLASS.dragHandle.nested,
      'group-hover/docs-tree-head:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
      actionVisible && 'opacity-100',
      fill('digest'),
    ),
    dragIcon: 'size-3.5',
    titleButton: cn('row-center min-w-0 flex-1 plain-button text-left leading-5', fg('digest')),
    arrowIcon: cn('size-3 ml-1.5 shrink-0 -rotate-90 trans-all-100', fill('digest')),
    arrowCollapsed: 'rotate-180',
    title: cn('truncate text-sm pointer smoky-65', `hover:${fg('title')}`),
    actionSlot: cn(
      'row-center relative ml-auto h-5 shrink-0 justify-end overflow-hidden',
      coverStatusVisible ? 'w-4' : 'w-0',
      'group-hover/docs-tree-head:w-10 group-focus-within/docs-tree-head:w-10',
      actionVisible && 'w-10',
    ),
    coverStatus: cn(
      'align-both absolute right-0 top-1/2 size-4 -translate-y-1/2 pointer-events-none opacity-100',
      'group-hover/docs-tree-head:opacity-0',
      'group-focus-within/docs-tree-head:opacity-0',
      actionVisible && 'opacity-0',
    ),
    coverStatusIcon: cn('size-3.5 opacity-50', fg('digest')),
    addButton: cn(
      'align-both size-5 plain-button opacity-0 trans-all-100',
      'group-hover/docs-tree-head:opacity-100',
      'group-focus-within/docs-tree-head:opacity-100',
      actionVisible && 'opacity-100',
      hover('box'),
    ),
    publishButton: cn(
      'hidden',
      'group-hover/docs-tree-head:opacity-100',
      'group-focus-within/docs-tree-head:opacity-100',
      actionVisible && 'opacity-100',
      hover('box'),
    ),
    actions: cn(
      'row-center size-5 opacity-0 trans-all-100',
      'group-hover/docs-tree-head:opacity-100',
      'group-focus-within/docs-tree-head:opacity-100',
      actionVisible && 'opacity-100',
    ),
    actionIcon: cn(icon, hover('icon')),
    publishIcon: cn(fgIcon, hover('fg')),
    children: cn(
      SIDE_TREE_CLASS.group.children,
      SIDE_TREE_SPACING.NODE_GAP,
      topLevel
        ? SIDE_TREE_SPACING.TOP_LEVEL_GROUP_CONTENT_GAP
        : SIDE_TREE_SPACING.NESTED_GROUP_CONTENT_GAP,
    ),
    collapsed: 'hidden',
  }
}
