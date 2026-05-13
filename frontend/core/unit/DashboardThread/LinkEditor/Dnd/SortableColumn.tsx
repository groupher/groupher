import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type ReactNode, memo } from 'react'

import type { TLinkDndType } from './spec'

type TRenderProps = {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: DraggableSyntheticListeners | undefined
  setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef']
  isDragging: boolean
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  className?: string
  columnId: string
  disabled?: boolean
  dndType: TLinkDndType
  idPrefix: string
}

// Sortable wrapper for whole dashboard link columns/groups. Drag activation is
// delegated to a separate handle via setActivatorNodeRef so the column body can
// keep accepting nested link drag/drop interactions.
const SortableColumn = memo(function SortableColumn({
  children,
  className = '',
  columnId,
  disabled = false,
  dndType,
  idPrefix,
}: TProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${idPrefix}:${columnId}`,
    disabled: disabled || !dndType.sortableColumn,
    data: {
      type: dndType.sortableColumn,
      columnId,
    },
  })

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  )
})

export default SortableColumn
