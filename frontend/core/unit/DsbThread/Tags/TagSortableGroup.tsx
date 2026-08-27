import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type MutableRefObject, type ReactNode, memo } from 'react'

import { cn } from './salon/group_block'

type TProps = {
  children: ReactNode
  className: string
  groupId: string
  ids: string[]
  listRef: MutableRefObject<HTMLDivElement | null>
  overClassName: string
}

// Droppable/sortable wrapper for one tag group. It exposes the group list rect
// through dnd-kit data so collision logic can distinguish empty group drops from
// drops over individual tags.
const TagSortableGroup = memo(function TagSortableGroup({
  children,
  className,
  groupId,
  ids,
  listRef,
  overClassName,
}: TProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tag-group:${groupId}`,
    data: {
      type: 'tag-group',
      groupId,
      getListRect: () => listRef.current?.getBoundingClientRect(),
    },
  })

  const setListNodeRef = (node: HTMLDivElement | null): void => {
    listRef.current = node
    setNodeRef(node)
  }

  return (
    <SortableContext id={groupId} items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setListNodeRef} className={cn(className, isOver && overClassName)}>
        {children}
      </div>
    </SortableContext>
  )
})

export default TagSortableGroup
