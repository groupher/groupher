import { useSortable } from '@dnd-kit/sortable'
import { memo, type ReactNode, useCallback, useRef } from 'react'

import { cn } from '~/css'
import useTwBelt from '~/hooks/useTwBelt'
import GrabDotsSVG from '~/icons/GrabDots'

import { SIDE_TREE_DND_TYPE } from './constant'
import { toTranslateOnlyTransform } from './dndHelper'

type TProps = {
  children: ReactNode
  columnId: string
  editing?: boolean
  id: string
  targetPosition?: 'before' | 'after' | null
}

// Sortable wrapper for a docs page/link row. The handle lives in an outside
// gutter, while the row content keeps its original x-position.
const SortableSideTreeChild = memo(function SortableSideTreeChild({
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
      childId: id,
      type: SIDE_TREE_DND_TYPE.CHILD,
      columnId,
      itemId: id,
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
        'group/docs-tree-sortable-child relative -ml-7 w-[calc(100%+1.75rem)] rounded-md pl-7 will-change-transform',
        isDragging && 'z-10 select-none',
      )}
    >
      {!editing && (
        <button
          ref={setActivatorNodeRef}
          type='button'
          className={cn(
            'row-center absolute left-1 top-1/2 size-5 -translate-y-1/2 cursor-grab border-0 bg-transparent p-0 opacity-0 trans-all-100',
            'group-hover/docs-tree-sortable-child:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
            fill('digest'),
          )}
          aria-label='Drag docs item'
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

export default SortableSideTreeChild
