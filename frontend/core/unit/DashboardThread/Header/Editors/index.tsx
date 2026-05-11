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
import type { Dispatch, FC, SetStateAction } from 'react'
import { useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import type { THeaderLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Button from '~/widgets/Buttons/Button'

import useSalon from '../../salon/header/editors'
import {
  HEADER_DND_CONTEXT_ID,
  HEADER_DND_TYPE,
  DND_ANNOUNCEMENTS,
  DND_MEASURING,
} from './constants'
import FixedLinks from './FixedLinks'
import GroupInputer from './GroupInputer'
import HeaderColumn from './HeaderColumn'
import type { THeaderDragTarget } from './spec'
import useHeaderEditorActions from './useHeaderEditorActions'
import useHeaderLinkDnd from './useHeaderLinkDnd'

type TProps = {
  links: readonly THeaderLinkItem[]
  onChange: Dispatch<SetStateAction<readonly THeaderLinkItem[]>>
  makeId: (prefix: string) => string
}

const Editor: FC<TProps> = ({ links, makeId, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug } = useCommunity()
  const pointerYRef = useRef<number | null>(null)
  const lastDragTargetRef = useRef<THeaderDragTarget | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [activeDragColumnId, setActiveDragColumnId] = useState<string | null>(null)
  const [targetDragColumnId, setTargetDragColumnId] = useState<string | null>(null)
  const editor = useHeaderEditorActions({ links, makeId, onChange })
  const {
    cancelDrag,
    columns,
    commitDrag,
    findColumnWithLink: findCurrentColumnWithLink,
    moveDrag,
    startDrag,
  } = useHeaderLinkDnd({
    links,
    community: slug,
    onCommit: onChange,
  })

  const getOverRect = (over: Over): DOMRect | typeof over.rect => {
    const getRect = over.data.current?.getRect
    const rect = typeof getRect === 'function' ? getRect() : null

    return rect || over.rect
  }

  const getDragTarget = ({
    active,
    over,
  }: DragOverEvent | DragEndEvent): THeaderDragTarget | undefined => {
    if (!over) return

    const overData = over.data.current

    if (overData?.type === HEADER_DND_TYPE.LINK) {
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

    if (overData?.type === HEADER_DND_TYPE.COLUMN) {
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
        container.id !== args.active.id && container.data.current?.type === HEADER_DND_TYPE.LINK,
    )
    const groupContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === HEADER_DND_TYPE.COLUMN,
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

  const isAboutLinkFold = links.length > 0

  return (
    <div className={s.wrapper}>
      <div className={s.topWrapper}>
        <div className={s.leftPart}>
          <FixedLinks isAboutLinkFold={isAboutLinkFold} />
        </div>
        <ul className={s.rightPart}>
          <h3 className={s.noteTitle}>{t('dsb.header.editors.note.title')}</h3>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.fixed')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.about')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.preview')}</li>
        </ul>
      </div>

      <div className={s.divider} />

      <div className={s.adder}>
        <Button size='small' onClick={editor.triggerLinkAdd} space={0.5} ghost noBorder>
          <PlusSVG className={s.plusIcon} />
          {t('dsb.header.editors.link')}
        </Button>
        <div className={s.slash}>/</div>
        <Button size='small' onClick={editor.triggerGroupAdd} space={0.5} ghost noBorder>
          <PlusSVG className={s.plusIcon} />
          {t('dsb.header.editors.group')}
        </Button>
      </div>

      {editor.editingGroup !== null && editor.editingGroupIndex === null && (
        <div className={s.groupInputer}>
          <GroupInputer
            value={editor.editingGroup}
            onChange={editor.updateEditingGroup}
            onConfirm={editor.saveGroup}
            onCancel={editor.cancelGroupChange}
          />
        </div>
      )}

      <DndContext
        id={HEADER_DND_CONTEXT_ID}
        sensors={sensors}
        accessibility={{ announcements: DND_ANNOUNCEMENTS }}
        measuring={DND_MEASURING}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={s.linkGroup}>
          {columns.map((column) => {
            const isCrossGroupTarget =
              !!activeDragColumnId &&
              !!targetDragColumnId &&
              targetDragColumnId === column.id &&
              activeDragColumnId !== column.id

            return (
              <HeaderColumn
                key={column.id}
                column={column}
                customLinksLength={links.length}
                editor={editor}
                isCollapsed={editor.collapsedGroups.has(column.id)}
                isCrossGroupTarget={isCrossGroupTarget}
              />
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}

export default Editor
