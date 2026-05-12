import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useCallback, useRef } from 'react'

import { cn } from '~/css'
import GrabDotsSVG from '~/icons/GrabDots'
import type { TTag } from '~/spec'

import TagBar from './TagBar'

const clampTranslateX = (x: number): number => Math.max(-12, Math.min(36, x))

type TProps = {
  tag: TTag
  groupId: string
  getListRect: () => DOMRect | undefined
  handleClassName: string
  itemClassName: string
  itemDraggingClassName: string
  isFirst: boolean
  isLast: boolean
  total: number
  onSetting: (tag: TTag) => void
}

type TSortableProps = TProps & {
  id: string
}

const SortableTagItemInner = memo(function SortableTagItemInner({
  id,
  tag,
  groupId,
  getListRect,
  handleClassName,
  itemClassName,
  itemDraggingClassName,
  isFirst,
  isLast,
  total,
  onSetting,
}: TSortableProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const setCardRef = useCallback((node: HTMLDivElement | null): void => {
    cardRef.current = node
  }, [])
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: 'tag',
      groupId,
      tagId: id,
      getRect: () => cardRef.current?.getBoundingClientRect(),
      getListRect,
    },
  })

  const style = {
    transform: transform
      ? CSS.Transform.toString({
          ...transform,
          x: clampTranslateX(transform.x),
        })
      : undefined,
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(itemClassName, isDragging && itemDraggingClassName)}
    >
      <button
        ref={setActivatorNodeRef}
        type='button'
        className={handleClassName}
        aria-label='Drag tag'
        {...attributes}
        {...listeners}
      >
        <GrabDotsSVG className='size-4' />
      </button>

      <TagBar
        tag={tag}
        isFirst={isFirst}
        isLast={isLast}
        total={total}
        onSetting={onSetting}
        itemRef={setCardRef}
        inGroup
      />
    </div>
  )
})

const SortableTagItem = memo(function SortableTagItem(props: TProps) {
  const id = props.tag.id

  if (!id) {
    return (
      <TagBar
        tag={props.tag}
        isFirst={props.isFirst}
        isLast={props.isLast}
        total={props.total}
        onSetting={props.onSetting}
        inGroup
      />
    )
  }

  return <SortableTagItemInner {...props} id={id} />
})

export default SortableTagItem
