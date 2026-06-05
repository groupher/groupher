import { MeasuringStrategy, type Announcements } from '@dnd-kit/core'

export const SIDE_TREE_DND_TYPE = {
  CHILD: 'docs-side-tree-child',
  GROUP: 'docs-side-tree-group',
  SORTABLE_GROUP: 'docs-side-tree-sortable-group',
} as const

export const SIDE_TREE_DND_CONTEXT_ID = 'dashboard-docs-side-tree-dnd'

export const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
}

type TDragActive = Parameters<NonNullable<Announcements['onDragStart']>>[0]['active']

const dragItemLabel = (active: TDragActive): string =>
  active.data.current?.type === SIDE_TREE_DND_TYPE.SORTABLE_GROUP ? 'docs group' : 'docs item'

const dragItemSentenceLabel = (active: TDragActive): string =>
  active.data.current?.type === SIDE_TREE_DND_TYPE.SORTABLE_GROUP ? 'Docs group' : 'Docs item'

export const DND_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `Picked up ${dragItemLabel(active)} ${active.id}.`
  },
  onDragOver({ active, over }) {
    return over
      ? `${dragItemSentenceLabel(active)} ${active.id} moved over ${over.id}.`
      : `${dragItemSentenceLabel(active)} ${active.id} left drop area.`
  },
  onDragEnd({ active, over }) {
    return over
      ? `${dragItemSentenceLabel(active)} ${active.id} dropped over ${over.id}.`
      : `${dragItemSentenceLabel(active)} ${active.id} dropped.`
  },
  onDragCancel({ active }) {
    return `Dragging ${dragItemLabel(active)} ${active.id} was cancelled.`
  },
}
