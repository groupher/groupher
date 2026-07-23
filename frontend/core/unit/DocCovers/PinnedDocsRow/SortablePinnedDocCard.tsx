import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { cn } from '~/css'

import type { TDocCoverPinnedDoc } from '../spec'
import PinnedDocCard from './PinnedDocCard'
import useSalon from './salon'

type TProps = {
  doc: TDocCoverPinnedDoc
  onEdit?: (doc: TDocCoverPinnedDoc) => void
  onUnpin?: (doc: TDocCoverPinnedDoc) => void
}

export default function SortablePinnedDocCard({ doc, onEdit, onUnpin }: TProps) {
  const s = useSalon()
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.nodeId })

  return (
    <div
      ref={setNodeRef}
      className={cn(s.sortable, isDragging && s.dragging)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <PinnedDocCard
        doc={doc}
        editable
        dragHandleRef={setActivatorNodeRef}
        dragHandleProps={{ ...attributes, ...listeners }}
        onEdit={onEdit}
        onUnpin={onUnpin}
      />
    </div>
  )
}
