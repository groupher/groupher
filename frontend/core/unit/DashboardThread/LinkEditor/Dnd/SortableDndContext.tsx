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

const sameDragTarget = (left: TLinkDndTarget | null, right: TLinkDndTarget | null): boolean =>
  left?.columnId === right?.columnId &&
  left?.itemId === right?.itemId &&
  left?.position === right?.position

// DnD shell shared by header/footer link editors. It owns sensor setup,
// collision detection, and event routing, while each editor owns the actual data
// transformation through its controller. Link drag targets carry item placement;
// column drag targets intentionally only carry the target column id.
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
  const lastColumnTargetIdRef = useRef<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [activeDragColumnId, setActiveDragColumnId] = useState<string | null>(null)
  const [targetDragColumnId, setTargetDragColumnId] = useState<string | null>(null)
  const [targetDragItemId, setTargetDragItemId] = useState<string | null>(null)
  const [targetDragPosition, setTargetDragPosition] = useState<TLinkDndTarget['position'] | null>(
    null,
  )

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

  const getColumnDragTargetId = ({ over }: DragOverEvent | DragEndEvent): string | undefined => {
    if (!over || over.data.current?.type !== dndType.sortableColumn) return

    return over.data.current.columnId
  }

  const handleDragStart = ({ active }: DragStartEvent): void => {
    if (active.data.current?.type === dndType.sortableColumn) {
      const columnId = active.data.current.columnId || String(active.id)
      lastDragTargetRef.current = null
      lastColumnTargetIdRef.current = null
      setActiveDragColumnId(columnId)
      setTargetDragColumnId(null)
      setTargetDragItemId(null)
      setTargetDragPosition(null)
      controller.startColumnDrag?.(columnId)
      return
    }

    const source = controller.findColumnWithLink(String(active.id))
    lastDragTargetRef.current = null
    setActiveDragColumnId(source?.column.id || null)
    setTargetDragColumnId(null)
    setTargetDragItemId(null)
    setTargetDragPosition(null)
    controller.startDrag(String(active.id))
  }

  const handleDragOver = (event: DragOverEvent): void => {
    if (event.active.data.current?.type === dndType.sortableColumn) {
      const targetColumnId = getColumnDragTargetId(event) || null
      if (lastColumnTargetIdRef.current === targetColumnId) return

      lastColumnTargetIdRef.current = targetColumnId
      setTargetDragColumnId(targetColumnId)
      setTargetDragItemId(null)
      setTargetDragPosition(null)
      return
    }

    const target = getDragTarget(event) || null
    if (sameDragTarget(lastDragTargetRef.current, target)) return

    lastDragTargetRef.current = target
    setTargetDragColumnId(target?.columnId || null)
    setTargetDragItemId(target?.itemId || null)
    setTargetDragPosition(target?.position || null)
    controller.moveDrag(target)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const target = lastDragTargetRef.current
    lastDragTargetRef.current = null
    const targetColumnId = lastColumnTargetIdRef.current
    lastColumnTargetIdRef.current = null
    setActiveDragColumnId(null)
    setTargetDragColumnId(null)
    setTargetDragItemId(null)
    setTargetDragPosition(null)

    if (event.active.data.current?.type === dndType.sortableColumn) {
      controller.commitColumnDrag?.(targetColumnId)
      return
    }

    controller.commitDrag(target)
  }

  const handleDragCancel = (_event: DragCancelEvent): void => {
    lastDragTargetRef.current = null
    lastColumnTargetIdRef.current = null
    setActiveDragColumnId(null)
    setTargetDragColumnId(null)
    setTargetDragItemId(null)
    setTargetDragPosition(null)
    controller.cancelDrag()
  }

  const collisionDetection: CollisionDetection = (args) => {
    pointerYRef.current = args.pointerCoordinates?.y ?? null

    if (args.active.data.current?.type === dndType.sortableColumn) {
      const columnSortContainers = args.droppableContainers.filter(
        (container) =>
          container.id !== args.active.id &&
          container.data.current?.type === dndType.sortableColumn,
      )

      return closestCorners({ ...args, droppableContainers: columnSortContainers })
    }

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
        targetDragItemId,
        targetDragPosition,
      })}
    </DndContext>
  )
}
