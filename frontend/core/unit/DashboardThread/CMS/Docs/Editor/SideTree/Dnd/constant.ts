import { MeasuringStrategy, type Announcements } from '@dnd-kit/core'

export const SIDE_TREE_DND_TYPE = {
  NODE: 'docs-side-tree-node',
  CONTAINER: 'docs-side-tree-container',
} as const

export const SIDE_TREE_DND_LANE = {
  GROUPS: 'groups',
  LEAVES: 'leaves',
} as const

export const SIDE_TREE_DND_TIMING = {
  AUTO_EXPAND_DELAY_MS: 600,
} as const

export const SIDE_TREE_DND_CONTEXT_ID = 'dashboard-docs-side-tree-dnd'

export const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.WhileDragging,
  },
}

type TDragActive = Parameters<NonNullable<Announcements['onDragStart']>>[0]['active']

const dragItemLabel = (active: TDragActive): string =>
  active.data.current?.nodeType === 'group' ? 'docs group' : 'docs item'

const dragItemSentenceLabel = (active: TDragActive): string =>
  active.data.current?.nodeType === 'group' ? 'Docs group' : 'Docs item'

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
