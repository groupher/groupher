import { useSortable } from '@dnd-kit/sortable'
import { memo, type ReactNode, useCallback, useRef } from 'react'

import { cn } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'
import GrabDotsSVG from '~/icons/GrabDots'

import { toTranslateOnlyTransform } from '../../SideTreeEditor/dndHelper'
import { FAQ_DND_TYPE, FAQ_EDITOR_COPY } from '../constant'

type TProps = {
  children: ReactNode
  columnId: string
  editing?: boolean
  id: string
  targetPosition?: 'before' | 'after' | null
}

const SortableFaqItem = memo(function SortableFaqItem({
  children,
  columnId,
  editing = false,
  id,
  targetPosition = null,
}: TProps) {
  const { fill, primary } = useTwBelt()
  const rowRef = useRef<HTMLDivElement | null>(null)
  const setRowRef = useCallback((node: HTMLDivElement | null): void => {
    rowRef.current = node
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
    disabled: editing,
    data: {
      itemId: id,
      type: FAQ_DND_TYPE.ITEM,
      columnId,
      getRect: () => rowRef.current?.getBoundingClientRect(),
    },
  })

  const style = {
    transform: toTranslateOnlyTransform(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/doc-faq-sortable-item relative -ml-7 w-[calc(100%+1.75rem)] pl-7 will-change-transform',
        isDragging && 'z-10 select-none',
      )}
    >
      {!editing && (
        <button
          ref={setActivatorNodeRef}
          type='button'
          className={cn(
            'row-center absolute left-1 top-2.5 size-5 cursor-grab border-0 bg-transparent p-0 opacity-0 trans-all-100',
            'group-hover/doc-faq-sortable-item:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
            fill('digest'),
          )}
          aria-label={FAQ_EDITOR_COPY.DRAG_ITEM_ARIA_LABEL}
          {...attributes}
          {...listeners}
        >
          <GrabDotsSVG className='size-3.5' />
        </button>
      )}

      {targetPosition === 'before' && (
        <div className={cn('absolute -top-1 left-7 right-0 h-px', primary('bg'))} />
      )}

      <div ref={setRowRef} className='w-full min-w-0'>
        {children}
      </div>

      {targetPosition === 'after' && (
        <div className={cn('absolute -bottom-1 left-7 right-0 h-px', primary('bg'))} />
      )}
    </div>
  )
})

export default SortableFaqItem
