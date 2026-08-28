import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, type ReactNode, useCallback, useRef } from 'react'

import { cn } from '~/css'
import GrabDotsSVG from '~/icons/GrabDots'

import useSalon from '../salon/sortable_link_item'
import type { TLinkDndType } from './spec'

type TProps = {
  ariaLabel: string
  children: ReactNode
  columnId: string
  disabled?: boolean
  dndType: TLinkDndType
  editing?: boolean
  id: string
  data?: Record<string, unknown>
}

const clampTranslateX = (x: number): number => Math.max(-18, Math.min(60, x))

const SortableItem = memo(function SortableItem({
  ariaLabel,
  children,
  columnId,
  data,
  disabled = false,
  dndType,
  editing = false,
  id,
}: TProps) {
  const s = useSalon()
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
    disabled,
    data: {
      ...data,
      type: dndType.link,
      columnId,
      itemId: id,
      getRect: () => cardRef.current?.getBoundingClientRect(),
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
      className={cn(s.wrapper, !editing && s.hoverable, isDragging && s.dragging)}
    >
      {!disabled && !editing && (
        <button
          ref={setActivatorNodeRef}
          type='button'
          className={s.dragHandle}
          aria-label={ariaLabel}
          {...attributes}
          {...listeners}
        >
          <GrabDotsSVG className='size-4' />
        </button>
      )}

      <div ref={setCardRef} className='w-full text-left'>
        {children}
      </div>
    </div>
  )
})

export default SortableItem
