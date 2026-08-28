import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { FC } from 'react'

import GrabDotsSVG from '~/icons/GrabDots'

import useSalon from './salon/group_head'

type TProps = {
  attributes: DraggableAttributes
  label: string
  listeners: DraggableSyntheticListeners | undefined
  setActivatorNodeRef: (element: HTMLElement | null) => void
}

// Shared visual and accessibility wrapper for group/column drag handles. The
// handle is positioned by GroupHead; callers only provide dnd-kit activator
// bindings and an aria label for the concrete editor context.
const GroupDragHandle: FC<TProps> = ({ attributes, label, listeners, setActivatorNodeRef }) => {
  const s = useSalon()

  return (
    <button
      ref={setActivatorNodeRef}
      type='button'
      className={s.dragHandle}
      aria-label={label}
      {...attributes}
      {...listeners}
    >
      <GrabDotsSVG className={s.dragIcon} />
    </button>
  )
}

export default GroupDragHandle
