import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'

import PlusSVG from '~/icons/Plus'

import type { TDocCoverPinnedDoc } from '../spec'
import useSalon from './salon'
import SortablePinnedDocCard from './SortablePinnedDocCard'

type TProps = {
  docs: readonly TDocCoverPinnedDoc[]
  onAdd?: () => void
  onEdit?: (doc: TDocCoverPinnedDoc) => void
  onUnpin?: (doc: TDocCoverPinnedDoc) => void
  onReorder?: (docs: readonly TDocCoverPinnedDoc[]) => void
}

export default function EditablePinnedDocsRow({ docs, onAdd, onEdit, onUnpin, onReorder }: TProps) {
  const s = useSalon()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        const from = docs.findIndex((doc) => doc.nodeId === active.id)
        const to = docs.findIndex((doc) => doc.nodeId === over.id)
        if (from >= 0 && to >= 0) onReorder?.(arrayMove([...docs], from, to))
      }}
    >
      <div className={s.scroller}>
        <SortableContext
          items={docs.map((doc) => doc.nodeId)}
          strategy={horizontalListSortingStrategy}
        >
          {docs.map((doc) => (
            <SortablePinnedDocCard key={doc.nodeId} doc={doc} onEdit={onEdit} onUnpin={onUnpin} />
          ))}
        </SortableContext>
        <button type='button' className={s.addButton} onClick={onAdd}>
          <PlusSVG className={s.addIcon} />
          <span>Add pinned doc</span>
        </button>
      </div>
    </DndContext>
  )
}
