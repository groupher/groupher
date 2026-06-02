import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type ReactNode, memo } from 'react'

import { FAQ_DND_TYPE, FAQ_SORTABLE_GROUP_ID_PREFIX } from './constant'

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

const SortableFaqColumn = memo(function SortableFaqColumn({
  children,
  className = '',
  columnId,
  disabled = false,
}: TProps) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({
      id: `${FAQ_SORTABLE_GROUP_ID_PREFIX}:${columnId}`,
      disabled,
      data: {
        type: FAQ_DND_TYPE.SORTABLE_GROUP,
        columnId,
      },
    })

  const style = {
    transform: transform
      ? CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 })
      : undefined,
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({ attributes, listeners, setActivatorNodeRef })}
    </div>
  )
})

export default SortableFaqColumn
