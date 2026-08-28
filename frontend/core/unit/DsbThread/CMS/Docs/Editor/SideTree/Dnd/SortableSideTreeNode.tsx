import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { type ReactNode, memo, useCallback, useRef } from 'react'

import { cn } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'

import { SIDE_TREE_CLASS } from '../salon'
import type { TSideTreeNodeType } from '../spec'
import { SIDE_TREE_DND_TYPE } from './constant'
import { toTranslateOnlyTransform } from './helper'
import type { TSideTreeDndLane, TSideTreeDropIntent } from './spec'

type TRenderProps = {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: DraggableSyntheticListeners | undefined
  setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef']
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  className?: string
  childGroupCount: number
  childLeafCount: number
  depth: number
  disabled?: boolean
  index: number
  lane: TSideTreeDndLane
  nodeId: string
  nodeType: TSideTreeNodeType
  parentNodeId: string
  targetIntent?: TSideTreeDropIntent | null
}

// Every Group uses this single node identity, regardless of its current depth.
const SortableSideTreeNode = memo(function SortableSideTreeNode({
  children,
  childGroupCount,
  childLeafCount,
  className = '',
  depth,
  disabled = false,
  index,
  lane,
  nodeId,
  nodeType,
  parentNodeId,
  targetIntent = null,
}: TProps) {
  const { primary } = useTwBelt()
  const rowRef = useRef<HTMLDivElement | null>(null)
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({
      id: nodeId,
      disabled,
      data: {
        type: SIDE_TREE_DND_TYPE.NODE,
        nodeId,
        nodeType,
        parentNodeId,
        lane,
        index,
        depth,
        childGroupCount,
        childLeafCount,
        getRect: () => rowRef.current?.getBoundingClientRect(),
      },
    })
  const setRefs = useCallback(
    (node: HTMLDivElement | null): void => {
      rowRef.current = node
      setNodeRef(node)
    },
    [setNodeRef],
  )

  const style = {
    transform: toTranslateOnlyTransform(transform),
    transition,
  }

  return (
    <div ref={setRefs} style={style} className={cn('relative', className)}>
      {targetIntent === 'before' && (
        <div className={cn(SIDE_TREE_CLASS.groupDropIndicator.before, primary('bg'))} />
      )}
      {children({ attributes, listeners, setActivatorNodeRef })}
      {targetIntent === 'after' && (
        <div className={cn(SIDE_TREE_CLASS.groupDropIndicator.after, primary('bg'))} />
      )}
    </div>
  )
})

export default SortableSideTreeNode
