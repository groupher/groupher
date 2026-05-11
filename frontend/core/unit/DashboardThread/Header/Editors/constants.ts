import { MeasuringStrategy, type Announcements } from '@dnd-kit/core'

import { SYSTEM_ABOUT_ID, SYSTEM_DASHBOARD_ID } from '~/hooks/useHeaderLinks/helper'

export const HEADER_COLUMN_KIND = {
  LINK: 'link',
  GROUP: 'group',
  MORE: 'more',
} as const

export const HEADER_DND_TYPE = {
  LINK: 'header-link',
  COLUMN: 'header-column',
} as const

export const SYSTEM_LINK_IDS = new Set([SYSTEM_ABOUT_ID, SYSTEM_DASHBOARD_ID])

export const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
}

export const DND_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `Picked up header link ${active.id}.`
  },
  onDragOver({ active, over }) {
    return over
      ? `Header link ${active.id} moved over ${over.id}.`
      : `Header link ${active.id} left drop area.`
  },
  onDragEnd({ active, over }) {
    return over
      ? `Header link ${active.id} dropped over ${over.id}.`
      : `Header link ${active.id} dropped.`
  },
  onDragCancel({ active }) {
    return `Dragging header link ${active.id} was cancelled.`
  },
}
