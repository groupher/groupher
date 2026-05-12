import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { type ReactNode, useRef, useState } from 'react'

import type { TLinkItem } from '~/spec'

import {
  FOOTER_DND_CONTEXT_ID,
  FOOTER_DND_TYPE,
  DND_ANNOUNCEMENTS,
  DND_MEASURING,
} from './constants'
import type { TFooterColumn, TFooterDragTarget } from './spec'
import useFooterLinkDnd from './useFooterLinkDnd'

type TRenderProps = {
  activeDragColumnId: string | null
  columns: TFooterColumn[]
  targetDragColumnId: string | null
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  links: readonly TLinkItem[]
  onCommit: (links: readonly TLinkItem[]) => void
}

export default function FooterDndContext({ children, links, onCommit }: TProps) {
  const pointerYRef = useRef<number | null>(null)
  const lastDragTargetRef = useRef<TFooterDragTarget | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [activeDragColumnId, setActiveDragColumnId] = useState<string | null>(null)
  const [targetDragColumnId, setTargetDragColumnId] = useState<string | null>(null)
  const {
    cancelDrag,
    columns,
    commitDrag,
    findColumnWithLink: findCurrentColumnWithLink,
    moveDrag,
    startDrag,
  } = useFooterLinkDnd({
    links,
    onCommit,
  })

  const getOverRect = (over: Over): DOMRect | typeof over.rect => {
    const getRect = over.data.current?.getRect
    const rect = typeof getRect === 'function' ? getRect() : null

    return rect || over.rect
  }

  const getDragTarget = ({
    active,
    over,
  }: DragOverEvent | DragEndEvent): TFooterDragTarget | undefined => {
    if (!over) return

    const overData = over.data.current

    if (overData?.type === FOOTER_DND_TYPE.LINK) {
      const overRect = getOverRect(over)
      const activeRect = active.rect.current.translated
      const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top
      const targetY = pointerYRef.current ?? activeCenterY
      const overCenterY = overRect.top + overRect.height / 2

      return {
        columnId: overData.columnId,
        itemId: overData.itemId,
        position: targetY > overCenterY ? 'after' : 'before',
      }
    }

    if (overData?.type === FOOTER_DND_TYPE.COLUMN) {
      return {
        columnId: overData.columnId,
      }
    }
  }

  const handleDragStart = ({ active }: DragStartEvent): void => {
    const source = findCurrentColumnWithLink(String(active.id))
    lastDragTargetRef.current = null
    setActiveDragColumnId(source?.column.id || null)
    setTargetDragColumnId(null)
    startDrag(String(active.id))
  }

  const handleDragOver = (event: DragOverEvent): void => {
    const target = getDragTarget(event) || null
    lastDragTargetRef.current = target
    setTargetDragColumnId(target?.columnId || null)
    moveDrag(target)
  }

  const handleDragEnd = (_event: DragEndEvent): void => {
    const target = lastDragTargetRef.current
    lastDragTargetRef.current = null
    setActiveDragColumnId(null)
    setTargetDragColumnId(null)
    commitDrag(target)
  }

  const handleDragCancel = (_event: DragCancelEvent): void => {
    lastDragTargetRef.current = null
    setActiveDragColumnId(null)
    setTargetDragColumnId(null)
    cancelDrag()
  }

  const collisionDetection: CollisionDetection = (args) => {
    pointerYRef.current = args.pointerCoordinates?.y ?? null
    const linkContainers = args.droppableContainers.filter(
      (container) =>
        container.id !== args.active.id && container.data.current?.type === FOOTER_DND_TYPE.LINK,
    )
    const groupContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === FOOTER_DND_TYPE.COLUMN,
    )

    const linkArgs = { ...args, droppableContainers: linkContainers }
    const pointerCollisions = pointerWithin(linkArgs)
    if (pointerCollisions.length > 0) return pointerCollisions

    const groupArgs = { ...args, droppableContainers: groupContainers }
    const groupPointerCollisions = pointerWithin(groupArgs)
    if (groupPointerCollisions.length > 0) return groupPointerCollisions

    const cornerCollisions = closestCorners(linkArgs)
    if (cornerCollisions.length > 0) return cornerCollisions

    return closestCorners(groupArgs)
  }

  return (
    <DndContext
      id={FOOTER_DND_CONTEXT_ID}
      sensors={sensors}
      accessibility={{ announcements: DND_ANNOUNCEMENTS }}
      measuring={DND_MEASURING}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children({ activeDragColumnId, columns, targetDragColumnId })}
    </DndContext>
  )
}
