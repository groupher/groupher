import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type ReactNode, type RefCallback, memo, useCallback } from 'react'

import { cn } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'

import { SIDE_TREE_DND_TYPE } from './constant'
import type { TSideTreeDndLane } from './spec'

type TProps = {
  children: ReactNode
  className: string
  depth: number
  disabled?: boolean
  externalListRef?: RefCallback<HTMLDivElement>
  ids: string[]
  lane: TSideTreeDndLane
  parentNodeId: string
  targetInside?: boolean
}

const SortableSideTreeGroup = memo(function SortableSideTreeGroup({
  children,
  className,
  depth,
  disabled = false,
  externalListRef,
  ids,
  lane,
  parentNodeId,
  targetInside = false,
}: TProps) {
  const { primary } = useTwBelt()
  const { setNodeRef } = useDroppable({
    id: `docs-side-tree-container:${parentNodeId}`,
    disabled,
    data: {
      type: SIDE_TREE_DND_TYPE.CONTAINER,
      parentNodeId,
      lane,
      index: ids.length,
      depth,
    },
  })
  const setRefs = useCallback(
    (node: HTMLDivElement | null): void => {
      setNodeRef(node)
      externalListRef?.(node)
    },
    [externalListRef, setNodeRef],
  )

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div
        ref={setRefs}
        className={cn(className, targetInside && primary('border'))}
        data-doc-tree-parent={parentNodeId}
      >
        {children}
      </div>
    </SortableContext>
  )
})

export default SortableSideTreeGroup
