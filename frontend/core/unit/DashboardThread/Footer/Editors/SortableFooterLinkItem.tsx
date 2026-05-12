import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, type ReactNode, useCallback, useRef } from 'react'

import { cn } from '~/css'
import GrabDotsSVG from '~/icons/GrabDots'

import useSalon from '../../salon/link_editor/sortable_link_item'
import { FOOTER_DND_TYPE } from './constants'

type TProps = {
  children: ReactNode
  columnId: string
  editing?: boolean
  id: string
}

const clampTranslateX = (x: number): number => Math.max(-18, Math.min(60, x))

const SortableFooterLinkItem = memo(function SortableFooterLinkItem({
  children,
  columnId,
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
    data: {
      type: FOOTER_DND_TYPE.LINK,
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
      {!editing && (
        <button
          ref={setActivatorNodeRef}
          type='button'
          className={s.dragHandle}
          aria-label='Drag footer link'
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

export default SortableFooterLinkItem
