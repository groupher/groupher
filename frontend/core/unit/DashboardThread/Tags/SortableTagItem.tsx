import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, useCallback, useRef } from 'react'

import { cn } from '~/css'
import GrabSVG from '~/icons/Grab'
import type { TTag } from '~/spec'

import TagBar from './TagBar'

const clampTranslateX = (x: number): number => Math.max(-12, Math.min(36, x))

type TProps = {
  tag: TTag
  group?: string
  groupKey: string
  getListRect: () => DOMRect | undefined
  handleClassName: string
  itemClassName: string
  itemDraggingClassName: string
  isFirst: boolean
  isLast: boolean
  total: number
  onSetting: (tag: TTag) => void
}

const SortableTagItem = memo(function SortableTagItem({
  tag,
  group,
  groupKey,
  getListRect,
  handleClassName,
  itemClassName,
  itemDraggingClassName,
  isFirst,
  isLast,
  total,
  onSetting,
}: TProps) {
  const id = tag.id
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
    id: id || '',
    data: {
      type: 'tag',
      group,
      groupKey,
      tagId: id,
      getRect: () => cardRef.current?.getBoundingClientRect(),
      getListRect,
    },
    disabled: !id,
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

  if (!id) {
    return (
      <TagBar
        tag={tag}
        isFirst={isFirst}
        isLast={isLast}
        total={total}
        onSetting={onSetting}
        inGroup
      />
    )
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
        <GrabSVG className='size-4' />
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

export default SortableTagItem
