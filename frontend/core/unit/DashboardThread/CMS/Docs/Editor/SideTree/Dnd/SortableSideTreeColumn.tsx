import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { type ReactNode, memo } from 'react'

import { SIDE_TREE_DND_TYPE } from './constant'
import { toTranslateOnlyTransform } from './helper'

type TRenderProps = {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: DraggableSyntheticListeners | undefined
  setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef']
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  className?: string
  columnId: string
  disabled?: boolean
}

// Sortable wrapper for a whole docs group. It is local to SideTree so group
// drag can clamp scale without changing header/footer sortable columns.
const SortableSideTreeColumn = memo(function SortableSideTreeColumn({
  children,
  className = '',
  columnId,
  disabled = false,
}: TProps) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({
      id: `docs-side-tree-sortable-group:${columnId}`,
      disabled,
      data: {
        type: SIDE_TREE_DND_TYPE.SORTABLE_GROUP,
        columnId,
      },
    })

  const style = {
    transform: toTranslateOnlyTransform(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({ attributes, listeners, setActivatorNodeRef })}
    </div>
  )
})

export default SortableSideTreeColumn
