import { MeasuringStrategy, type Announcements } from '@dnd-kit/core'

export const FOOTER_DND_TYPE = {
  LINK: 'footer-link',
  COLUMN: 'footer-column',
  SORTABLE_COLUMN: 'footer-sortable-column',
} as const

export const FOOTER_DND_CONTEXT_ID = 'dashboard-footer-links-dnd'

export const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
}

type TDragActive = Parameters<NonNullable<Announcements['onDragStart']>>[0]['active']

const dragItemLabel = (active: TDragActive): string =>
  active.data.current?.type === FOOTER_DND_TYPE.SORTABLE_COLUMN ? 'footer column' : 'footer link'

const dragItemSentenceLabel = (active: TDragActive): string =>
  active.data.current?.type === FOOTER_DND_TYPE.SORTABLE_COLUMN ? 'Footer column' : 'Footer link'

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
