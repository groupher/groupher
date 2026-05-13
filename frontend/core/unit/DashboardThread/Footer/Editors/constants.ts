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

export const DND_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `Picked up footer link ${active.id}.`
  },
  onDragOver({ active, over }) {
    return over
      ? `Footer link ${active.id} moved over ${over.id}.`
      : `Footer link ${active.id} left drop area.`
  },
  onDragEnd({ active, over }) {
    return over
      ? `Footer link ${active.id} dropped over ${over.id}.`
      : `Footer link ${active.id} dropped.`
  },
  onDragCancel({ active }) {
    return `Dragging footer link ${active.id} was cancelled.`
  },
}
