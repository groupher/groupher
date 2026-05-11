import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type ReactNode, memo, useRef } from 'react'

import { cn } from '~/css'

import { HEADER_DND_TYPE } from './constants'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  ids: string[]
  disabled?: boolean
  overClassName: string
  targetClassName?: string
}

const HeaderSortableGroup = memo(function HeaderSortableGroup({
  children,
  className,
  columnId,
  disabled = false,
  ids,
  overClassName,
  targetClassName = '',
}: TProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const { setNodeRef, isOver } = useDroppable({
    id: `header-column:${columnId}`,
    disabled,
    data: {
      type: HEADER_DND_TYPE.COLUMN,
      columnId,
      getListRect: () => listRef.current?.getBoundingClientRect(),
    },
  })

  const setListNodeRef = (node: HTMLDivElement | null): void => {
    listRef.current = node
    setNodeRef(node)
  }

  return (
    <SortableContext id={columnId} items={ids} strategy={verticalListSortingStrategy}>
      <div
        ref={setListNodeRef}
        className={cn(className, isOver && !targetClassName && overClassName, targetClassName)}
      >
        {children}
      </div>
    </SortableContext>
  )
})

export default HeaderSortableGroup
