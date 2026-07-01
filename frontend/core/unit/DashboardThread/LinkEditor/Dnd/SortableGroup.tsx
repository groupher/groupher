import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type ReactNode, type RefCallback, memo, useCallback, useRef } from 'react'

import { cnMerge } from '~/css'

import type { TLinkDndType } from './spec'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  dndType: TLinkDndType
  ids: string[]
  externalListRef?: RefCallback<HTMLDivElement>
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
  externalListRef,
  idPrefix,
  ids,
  overClassName,
  targetClassName = '',
}: TProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const externalNodeRef = useRef<HTMLDivElement | null>(null)
  const externalListRefRef = useRef(externalListRef)
  const { setNodeRef, isOver } = useDroppable({
    id: `${idPrefix}:${columnId}`,
    disabled,
    data: {
      type: dndType.column,
      columnId,
      getListRect: () => listRef.current?.getBoundingClientRect(),
    },
  })
  const setNodeRefRef = useRef(setNodeRef)

  externalListRefRef.current = externalListRef
  setNodeRefRef.current = setNodeRef

  const setListNodeRef = useCallback((node: HTMLDivElement | null): void => {
    if (listRef.current === node && externalNodeRef.current === node) return

    listRef.current = node

    if (externalNodeRef.current !== node) {
      externalNodeRef.current = node
      externalListRefRef.current?.(node)
    }

    setNodeRefRef.current(node)
  }, [])

  return (
    <SortableContext id={columnId} items={ids} strategy={verticalListSortingStrategy}>
      <div
        ref={setListNodeRef}
        className={cnMerge(className, isOver && !targetClassName && overClassName, targetClassName)}
      >
        {children}
      </div>
    </SortableContext>
  )
})

export default SortableGroup
