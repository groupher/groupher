import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { THREAD } from '~/const/thread'
import useMount from '~/hooks/useMount'
import type { TTag } from '~/spec'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useTags from '../logic/useTags'
import useSalon from '../salon/tags'
import GroupBlock from './GroupBlock'
import type { TDraftGroup } from './types'
import useTagDragDraft from './useTagDragDraft'

const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
}

const DROP_INDICATOR_GAP = 6

const DND_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `Picked up tag ${active.id}.`
  },
  onDragOver({ active, over }) {
    return over ? `Tag ${active.id} moved over ${over.id}.` : `Tag ${active.id} left drop area.`
  },
  onDragEnd({ active, over }) {
    return over ? `Tag ${active.id} dropped over ${over.id}.` : `Tag ${active.id} dropped.`
  },
  onDragCancel({ active }) {
    return `Dragging tag ${active.id} was cancelled.`
  },
}

type TProps = {
  draftGroups: readonly TDraftGroup[]
  onRemoveDraft: (draftId: string) => void
  onRenameDraft: (draftId: string, toGroup: string) => void
  onCompleteDraft: (draftId?: string) => void
  onSettingTag: (tag: TTag) => void
}

export default function TagList({
  draftGroups,
  onRemoveDraft,
  onRenameDraft,
  onCompleteDraft,
  onSettingTag,
}: TProps) {
  const { activeTagThread, commitTagSorting, loading, loadTags, tagGroups } = useTags()
  const s = useSalon()
  const dropIndicatorRef = useRef<HTMLDivElement | null>(null)
  const pointerYRef = useRef<number | null>(null)
  const indicatorFrameRef = useRef<number | null>(null)
  const [indicatorRoot, setIndicatorRoot] = useState<HTMLElement | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = ({ active }: DragStartEvent): void => {
    const activeData = active.data.current
    const activeId =
      activeData?.type === 'group' ? activeData.groupId : activeData?.tagId || String(active.id)

    startDrag(activeId)
  }

  const handleDragOver = (event: DragOverEvent): void => {
    if (event.active.data.current?.type === 'group') {
      if (indicatorFrameRef.current) cancelAnimationFrame(indicatorFrameRef.current)
      indicatorFrameRef.current = null
      updateDropIndicator(null)
      return
    }

    const target = getDragTarget(event) || null

    if (indicatorFrameRef.current) cancelAnimationFrame(indicatorFrameRef.current)
    indicatorFrameRef.current = requestAnimationFrame(() => {
      updateDropIndicator(event.over, target)
      indicatorFrameRef.current = null
    })
    moveTagDrag(target)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    if (event.active.data.current?.type === 'group') {
      commitGroupDrag(getGroupDragTarget(event) || null)
    } else {
      commitTagDrag(getDragTarget(event) || null)
    }

    if (indicatorFrameRef.current) cancelAnimationFrame(indicatorFrameRef.current)
    indicatorFrameRef.current = null
    updateDropIndicator(null)
  }

  const handleDragCancel = (_event: DragCancelEvent): void => {
    cancelDrag()
    if (indicatorFrameRef.current) cancelAnimationFrame(indicatorFrameRef.current)
    indicatorFrameRef.current = null
    updateDropIndicator(null)
  }

  const collisionDetection: CollisionDetection = (args) => {
    pointerYRef.current = args.pointerCoordinates?.y ?? null
    if (args.active.data.current?.type === 'group') {
      const groupContainers = args.droppableContainers.filter(
        (container) => container.id !== args.active.id && container.data.current?.type === 'group',
      )

      return closestCorners({ ...args, droppableContainers: groupContainers })
    }

    const tagContainers = args.droppableContainers.filter(
      (container) => container.id !== args.active.id && container.data.current?.type === 'tag',
    )
    const groupContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === 'tag-group',
    )

    const tagArgs = { ...args, droppableContainers: tagContainers }
    const tagPointerCollisions = pointerWithin(tagArgs)
    if (tagPointerCollisions.length > 0) return tagPointerCollisions

    const tagCornerCollisions = closestCorners(tagArgs)
    if (tagCornerCollisions.length > 0) return tagCornerCollisions

    return closestCorners({ ...args, droppableContainers: groupContainers })
  }

  useEffect(() => {
    setIndicatorRoot(document.body)

    return () => {
      if (indicatorFrameRef.current) cancelAnimationFrame(indicatorFrameRef.current)
      indicatorFrameRef.current = null
    }
  }, [])

  useMount(loadTags)
  const currentThread = activeTagThread || THREAD.POST
  const { cancelDrag, commitGroupDrag, commitTagDrag, groups, groupNames, moveTagDrag, startDrag } =
    useTagDragDraft({
      tagGroups,
      draftGroups,
      currentThread,
      onCommit: commitTagSorting,
    })

  const getOverRect = (over: Over): DOMRect | typeof over.rect => {
    const getRect = over.data.current?.getRect
    const rect = typeof getRect === 'function' ? getRect() : null

    return rect || over.rect
  }

  const getOverListRect = (over: Over): DOMRect | null => {
    const getListRect = over.data.current?.getListRect

    return typeof getListRect === 'function' ? getListRect() : null
  }

  const getDragTarget = ({ active, over }: DragOverEvent | DragEndEvent) => {
    if (!over) return

    const overData = over.data.current

    if (overData?.type === 'tag') {
      const overRect = getOverRect(over)
      const activeRect = active.rect.current.translated
      const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top
      const targetY = pointerYRef.current ?? activeCenterY
      const overCenterY = overRect.top + overRect.height / 2
      const position: 'before' | 'after' = targetY > overCenterY ? 'after' : 'before'

      return {
        tagId: overData.tagId,
        groupId: overData.groupId,
        position,
      }
    }

    if (overData?.type === 'tag-group') {
      return {
        groupId: overData.groupId,
      }
    }
  }

  const getGroupDragTarget = ({ active, over }: DragEndEvent) => {
    if (!over || over.data.current?.type !== 'group') return

    const overRect = getOverRect(over)
    const activeRect = active.rect.current.translated
    const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : overRect.top
    const targetY = pointerYRef.current ?? activeCenterY
    const overCenterY = overRect.top + overRect.height / 2

    return {
      groupId: over.data.current.groupId,
      position: targetY > overCenterY ? ('after' as const) : ('before' as const),
    }
  }

  const updateDropIndicator = (
    over: Over | null,
    target?: ReturnType<typeof getDragTarget>,
  ): void => {
    const node = dropIndicatorRef.current
    if (!node) return

    if (!over || over.data.current?.type !== 'tag' || !target || !('position' in target)) {
      node.style.opacity = '0'
      return
    }

    const overRect = getOverRect(over)
    const listRect = getOverListRect(over) || overRect
    const top =
      target.position === 'after'
        ? overRect.bottom + DROP_INDICATOR_GAP
        : overRect.top - DROP_INDICATOR_GAP

    node.style.opacity = '1'
    node.style.transform = `translate3d(${listRect.left}px, ${top}px, 0)`
    node.style.width = `${listRect.width}px`
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements: DND_ANNOUNCEMENTS }}
      measuring={DND_MEASURING}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div>
        {loading && <LavaLampLoading bottom={10} />}

        <SortableContext
          items={groups
            .filter((group) => !group.draft)
            .map((group) => `tag-group-sort:${group.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {groups.map((group) => (
            <GroupBlock
              key={group.id}
              title={group.title}
              groupId={group.id}
              tags={group.tags}
              draft={group.draft}
              draftId={group.draftId}
              activeThread={currentThread}
              groupNames={groupNames}
              onRemoveDraft={onRemoveDraft}
              onRenameDraft={onRenameDraft}
              onCompleteDraft={onCompleteDraft}
              onSettingTag={onSettingTag}
            />
          ))}
        </SortableContext>
      </div>
      {indicatorRoot &&
        createPortal(<div ref={dropIndicatorRef} className={s.dropIndicator} />, indicatorRoot)}
    </DndContext>
  )
}
