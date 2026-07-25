import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { type ReactNode, useMemo, useRef, useState } from 'react'

import type { TSideTreeGroup } from '../spec'
import {
  DND_ANNOUNCEMENTS,
  DND_MEASURING,
  SIDE_TREE_DND_CONTEXT_ID,
  SIDE_TREE_DND_LANE,
  SIDE_TREE_DND_TYPE,
} from './constant'
import { moveSideTreeNode, sameSideTreeGroups, sideTreeGroupSubtreeIds } from './model'
import type { TSideTreeDragData, TSideTreeDragTarget } from './spec'

type TRenderProps = {
  activeDragNodeId: string | null
  columns: TSideTreeGroup[]
  target: TSideTreeDragTarget | null
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  groups: readonly TSideTreeGroup[]
  onCommit: (groups: readonly TSideTreeGroup[], activeNodeId: string) => void
  rootParentNodeId: string
}

const sameTarget = (left: TSideTreeDragTarget | null, right: TSideTreeDragTarget | null): boolean =>
  left?.parentNodeId === right?.parentNodeId &&
  left?.lane === right?.lane &&
  left?.index === right?.index &&
  left?.intent === right?.intent &&
  left?.overNodeId === right?.overNodeId

const targetFromEvent = (
  event: DragOverEvent | DragEndEvent,
  pointerY: number | null,
): TSideTreeDragTarget | null => {
  if (!event.over) return null

  const data = event.over.data.current as TSideTreeDragData | undefined
  const activeData = event.active.data.current as TSideTreeDragData | undefined
  if (!data || activeData?.type !== SIDE_TREE_DND_TYPE.NODE) return null
  const activeLane = activeData.lane

  if (data.type === SIDE_TREE_DND_TYPE.CONTAINER) {
    if (data.lane !== activeLane) return null
    return {
      parentNodeId: data.parentNodeId,
      lane: activeLane,
      index: data.index,
      intent: 'inside',
      overNodeId: null,
    }
  }

  const overRect = data.getRect?.() || event.over.rect
  const activeRect = event.active.rect.current.translated
  const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top
  const targetY = pointerY ?? activeCenterY
  const relativeY = overRect.height > 0 ? (targetY - overRect.top) / overRect.height : 0.5

  if (data.nodeType === 'group' && relativeY >= 0.3 && relativeY <= 0.7) {
    return {
      parentNodeId: data.nodeId,
      lane: activeLane,
      index: activeLane === SIDE_TREE_DND_LANE.GROUPS ? data.childGroupCount : data.childLeafCount,
      intent: 'inside',
      overNodeId: data.nodeId,
    }
  }

  const after = relativeY > 0.5
  if (data.lane !== activeLane) {
    return {
      parentNodeId: data.parentNodeId,
      lane: activeLane,
      index: activeLane === SIDE_TREE_DND_LANE.GROUPS ? data.childGroupCount : 0,
      intent: after ? 'after' : 'before',
      overNodeId: data.nodeId,
    }
  }

  return {
    parentNodeId: data.parentNodeId,
    lane: activeLane,
    index: data.index + (after ? 1 : 0),
    intent: after ? 'after' : 'before',
    overNodeId: data.nodeId,
  }
}

export default function SideTreeDndContext({
  children,
  groups,
  onCommit,
  rootParentNodeId,
}: TProps) {
  const pointerYRef = useRef<number | null>(null)
  const lastTargetRef = useRef<TSideTreeDragTarget | null>(null)
  const invalidParentIdsRef = useRef<ReadonlySet<string>>(new Set())
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null)
  const [target, setTarget] = useState<TSideTreeDragTarget | null>(null)
  const columns = useMemo(() => [...groups], [groups])
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const collisionDetection: CollisionDetection = (args) => {
    pointerYRef.current = args.pointerCoordinates?.y ?? null
    const candidates = args.droppableContainers.filter((container) => {
      if (container.id === args.active.id) return false

      const activeData = args.active.data.current as TSideTreeDragData | undefined
      const data = container.data.current as TSideTreeDragData | undefined
      if (!activeData || !data) return false
      if (activeData.type !== SIDE_TREE_DND_TYPE.NODE) return false
      if (data.type !== SIDE_TREE_DND_TYPE.NODE && data.type !== SIDE_TREE_DND_TYPE.CONTAINER) {
        return false
      }

      const targetParentId =
        data.type === SIDE_TREE_DND_TYPE.CONTAINER ? data.parentNodeId : data.parentNodeId
      if (invalidParentIdsRef.current.has(targetParentId)) return false
      if (activeData.nodeType !== 'group' && targetParentId === rootParentNodeId) {
        return false
      }
      if (data.type === SIDE_TREE_DND_TYPE.CONTAINER && data.lane !== activeData.lane) {
        return false
      }
      if (
        data.type === SIDE_TREE_DND_TYPE.NODE &&
        data.lane !== activeData.lane &&
        data.nodeType !== 'group'
      ) {
        return false
      }

      return true
    })
    const pointerCollisions = pointerWithin({ ...args, droppableContainers: candidates })

    if (pointerCollisions.length > 0) {
      return pointerCollisions.toSorted((left, right) => {
        const leftData = left.data?.droppableContainer.data.current as TSideTreeDragData | undefined
        const rightData = right.data?.droppableContainer.data.current as
          | TSideTreeDragData
          | undefined
        const depthOrder = (rightData?.depth ?? -1) - (leftData?.depth ?? -1)
        if (depthOrder !== 0) return depthOrder

        const leftNodePriority = leftData?.type === SIDE_TREE_DND_TYPE.NODE ? 1 : 0
        const rightNodePriority = rightData?.type === SIDE_TREE_DND_TYPE.NODE ? 1 : 0
        return rightNodePriority - leftNodePriority
      })
    }

    return closestCenter({ ...args, droppableContainers: candidates })
  }

  const clearDrag = (): void => {
    lastTargetRef.current = null
    invalidParentIdsRef.current = new Set()
    setActiveDragNodeId(null)
    setTarget(null)
  }

  const handleDragStart = ({ active }: DragStartEvent): void => {
    const data = active.data.current as TSideTreeDragData | undefined
    if (data?.type !== SIDE_TREE_DND_TYPE.NODE) return

    invalidParentIdsRef.current =
      data.nodeType === 'group' ? sideTreeGroupSubtreeIds(groups, data.nodeId) : new Set()
    setActiveDragNodeId(data.nodeId)
  }

  const handleDragOver = (event: DragOverEvent): void => {
    const nextTarget = targetFromEvent(event, pointerYRef.current)
    if (sameTarget(lastTargetRef.current, nextTarget)) return

    lastTargetRef.current = nextTarget
    setTarget(nextTarget)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const activeData = event.active.data.current as TSideTreeDragData | undefined
    const activeId =
      activeData?.type === SIDE_TREE_DND_TYPE.NODE ? activeData.nodeId : activeDragNodeId
    const nextTarget = lastTargetRef.current || targetFromEvent(event, pointerYRef.current)
    clearDrag()

    if (!activeId || !nextTarget) return

    const nextGroups = moveSideTreeNode(groups, activeId, nextTarget, rootParentNodeId)
    if (sameSideTreeGroups(groups, nextGroups)) return

    onCommit(nextGroups, activeId)
  }

  return (
    <DndContext
      id={SIDE_TREE_DND_CONTEXT_ID}
      sensors={sensors}
      accessibility={{ announcements: DND_ANNOUNCEMENTS }}
      measuring={DND_MEASURING}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDrag}
    >
      {children({ activeDragNodeId, columns, target })}
    </DndContext>
  )
}
