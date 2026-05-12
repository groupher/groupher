import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type ReactNode, memo, useRef } from 'react'

import { cn } from '~/css'

import type { TLinkDndType } from './spec'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  dndType: TLinkDndType
  ids: string[]
  disabled?: boolean
  idPrefix: string
  overClassName: string
  targetClassName?: string
}

const SortableGroup = memo(function SortableGroup({
  children,
  className,
  columnId,
  disabled = false,
  dndType,
  idPrefix,
  ids,
  overClassName,
  targetClassName = '',
}: TProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const { setNodeRef, isOver } = useDroppable({
    id: `${idPrefix}:${columnId}`,
    disabled,
    data: {
      type: dndType.column,
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

export default SortableGroup
