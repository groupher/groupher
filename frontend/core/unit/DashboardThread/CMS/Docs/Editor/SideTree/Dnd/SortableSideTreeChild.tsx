import { useSortable } from '@dnd-kit/sortable'
import { memo, type ReactNode, useCallback, useRef, useState } from 'react'

import { cn } from '~/css'
import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import GrabDotsSVG from '~/icons/GrabDots'

import { SIDE_TREE_CLASS } from '../salon'
import { SIDE_TREE_SPACING } from '../salon/constant'
import type { TSideTreeChildType } from '../spec'
import { SIDE_TREE_DND_TYPE } from './constant'
import { toTranslateOnlyTransform } from './helper'
import type { TSideTreeDndLane } from './spec'

type TProps = {
  children: ReactNode
  depth: number
  disabled?: boolean
  editing?: boolean
  id: string
  index: number
  lane: TSideTreeDndLane
  nodeType: TSideTreeChildType
  parentNodeId: string
  targetPosition?: 'before' | 'after' | null
}

// Sortable wrapper for a docs page/link row. The handle lives in an outside
// gutter, while the row content keeps its original x-position.
const SortableSideTreeChild = memo(function SortableSideTreeChild({
  children,
  depth,
  disabled = false,
  editing = false,
  id,
  index,
  lane,
  nodeType,
  parentNodeId,
  targetPosition = null,
}: TProps) {
  const { fill, primary } = useTwBelt()
  const { t } = useTrans()
  const [hovered, setHovered] = useState(false)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const nested = depth > 1
  const setRowRef = useCallback((node: HTMLDivElement | null): void => {
    rowRef.current = node
  }, [])
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: disabled || editing,
    data: {
      type: SIDE_TREE_DND_TYPE.NODE,
      nodeId: id,
      nodeType,
      parentNodeId,
      lane,
      index,
      depth,
      childGroupCount: 0,
      childLeafCount: 0,
      getRect: () => rowRef.current?.getBoundingClientRect(),
    },
  })

  const style = {
    transform: toTranslateOnlyTransform(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        SIDE_TREE_CLASS.leaf.sortable,
        nested ? SIDE_TREE_CLASS.leaf.nestedWidth : SIDE_TREE_CLASS.leaf.topLevelWidth,
        nested ? SIDE_TREE_SPACING.NESTED_LEAF_INDENT : SIDE_TREE_SPACING.TOP_LEVEL_LEAF_GUTTER,
        isDragging && 'z-10 select-none',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!disabled && !editing && (
        <button
          ref={setActivatorNodeRef}
          type='button'
          className={cn(
            SIDE_TREE_CLASS.dragHandle.base,
            nested ? SIDE_TREE_CLASS.dragHandle.nested : SIDE_TREE_CLASS.dragHandle.topLevel,
            'group-hover/docs-tree-sortable-child:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
            hovered && 'opacity-100',
            fill('digest'),
          )}
          style={hovered ? { opacity: 1 } : undefined}
          aria-label={t('dsb.cms.docs.side_tree.drag_item')}
          {...attributes}
          {...listeners}
        >
          <GrabDotsSVG className='size-3.5' />
        </button>
      )}

      {targetPosition === 'before' && (
        <div
          className={cn(
            SIDE_TREE_CLASS.leafDropIndicator.before,
            nested
              ? SIDE_TREE_CLASS.leafDropIndicator.nested
              : SIDE_TREE_CLASS.leafDropIndicator.topLevel,
            primary('bg'),
          )}
        />
      )}

      <div ref={setRowRef} className='w-full min-w-0'>
        {children}
      </div>

      {targetPosition === 'after' && (
        <div
          className={cn(
            SIDE_TREE_CLASS.leafDropIndicator.after,
            nested
              ? SIDE_TREE_CLASS.leafDropIndicator.nested
              : SIDE_TREE_CLASS.leafDropIndicator.topLevel,
            primary('bg'),
          )}
        />
      )}
    </div>
  )
})

export default SortableSideTreeChild
