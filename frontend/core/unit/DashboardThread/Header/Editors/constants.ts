import { MeasuringStrategy, type Announcements } from '@dnd-kit/core'

import { MORE_TAB } from '~/hooks/useHeaderLinks/constant'

export const HEADER_COLUMN_KIND = {
  LINK: 'link',
  GROUP: 'group',
  MORE: 'more',
} as const

export const HEADER_DND_TYPE = {
  LINK: 'header-link',
  COLUMN: 'header-column',
  SORTABLE_COLUMN: 'header-sortable-column',
} as const

export const HEADER_DND_CONTEXT_ID = 'dashboard-header-links-dnd'

export const MORE_TAB_FIXED_LINK_IDS = new Set<string>([MORE_TAB.ABOUT_ID, MORE_TAB.DASHBOARD_ID])

export const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
}

type TDragActive = Parameters<NonNullable<Announcements['onDragStart']>>[0]['active']

const dragItemLabel = (active: TDragActive): string =>
  active.data.current?.type === HEADER_DND_TYPE.SORTABLE_COLUMN ? 'header column' : 'header link'

const dragItemSentenceLabel = (active: TDragActive): string =>
  active.data.current?.type === HEADER_DND_TYPE.SORTABLE_COLUMN ? 'Header column' : 'Header link'

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
