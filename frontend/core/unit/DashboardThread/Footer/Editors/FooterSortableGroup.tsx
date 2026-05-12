import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type ReactNode, memo, useRef } from 'react'

import { cn } from '~/css'

import { FOOTER_DND_TYPE } from './constants'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  ids: string[]
  overClassName: string
  targetClassName?: string
}

const FooterSortableGroup = memo(function FooterSortableGroup({
  children,
  className,
  columnId,
  ids,
  overClassName,
  targetClassName = '',
}: TProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const { setNodeRef, isOver } = useDroppable({
    id: `footer-column:${columnId}`,
    data: {
      type: FOOTER_DND_TYPE.COLUMN,
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

export default FooterSortableGroup
