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
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useRef, useState } from 'react'

import { getOverRect } from './helper'
import type { TLinkDndColumnBase, TLinkDndTarget, TSortableDndContextProps } from './spec'

export default function SortableDndContext<
  TColumn extends TLinkDndColumnBase,
  TTarget extends TLinkDndTarget,
>({
  children,
  contextId,
  controller,
  dndType,
  announcements,
  measuring,
}: TSortableDndContextProps<TColumn, TTarget>) {
  const pointerYRef = useRef<number | null>(null)
  const lastDragTargetRef = useRef<TTarget | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [activeDragColumnId, setActiveDragColumnId] = useState<string | null>(null)
  const [targetDragColumnId, setTargetDragColumnId] = useState<string | null>(null)

  const getDragTarget = ({ active, over }: DragOverEvent | DragEndEvent): TTarget | undefined => {
    if (!over) return

    const overData = over.data.current

    if (overData?.type === dndType.link) {
      const overRect = getOverRect(over)
      const activeRect = active.rect.current.translated
      const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top
      const targetY = pointerYRef.current ?? activeCenterY
      const overCenterY = overRect.top + overRect.height / 2

      return {
        columnId: overData.columnId,
        itemId: overData.itemId,
        position: targetY > overCenterY ? 'after' : 'before',
      } as TTarget
    }

    if (overData?.type === dndType.column) {
      return {
        columnId: overData.columnId,
      } as TTarget
    }
  }

  const handleDragStart = ({ active }: DragStartEvent): void => {
    const source = controller.findColumnWithLink(String(active.id))
    lastDragTargetRef.current = null
    setActiveDragColumnId(source?.column.id || null)
    setTargetDragColumnId(null)
    controller.startDrag(String(active.id))
  }

  const handleDragOver = (event: DragOverEvent): void => {
    const target = getDragTarget(event) || null
    lastDragTargetRef.current = target
    setTargetDragColumnId(target?.columnId || null)
    controller.moveDrag(target)
  }

  const handleDragEnd = (_event: DragEndEvent): void => {
    const target = lastDragTargetRef.current
    lastDragTargetRef.current = null
    setActiveDragColumnId(null)
    setTargetDragColumnId(null)
    controller.commitDrag(target)
  }

  const handleDragCancel = (_event: DragCancelEvent): void => {
    lastDragTargetRef.current = null
    setActiveDragColumnId(null)
    setTargetDragColumnId(null)
    controller.cancelDrag()
  }

  const collisionDetection: CollisionDetection = (args) => {
    pointerYRef.current = args.pointerCoordinates?.y ?? null
    const linkContainers = args.droppableContainers.filter(
      (container) =>
        container.id !== args.active.id && container.data.current?.type === dndType.link,
    )
    const groupContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === dndType.column,
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
      id={contextId}
      sensors={sensors}
      accessibility={{ announcements }}
      measuring={measuring}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children({
        activeDragColumnId,
        columns: controller.columns,
        targetDragColumnId,
      })}
    </DndContext>
  )
}
