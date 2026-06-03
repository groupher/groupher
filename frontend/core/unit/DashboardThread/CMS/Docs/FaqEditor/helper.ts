import type { Announcements } from '@dnd-kit/core'

import { FAQ_DND_TYPE } from './constant'

type TDragActive = Parameters<NonNullable<Announcements['onDragStart']>>[0]['active']

const dragItemLabel = (active: TDragActive): string =>
  active.data.current?.type === FAQ_DND_TYPE.SORTABLE_GROUP ? 'FAQ group' : 'FAQ item'

/**
 * Screen-reader status text for dnd-kit while reordering FAQ groups/items.
 */
export const DND_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `Picked up ${dragItemLabel(active)} ${active.id}.`
  },
  onDragOver({ active, over }) {
    return over
      ? `${dragItemLabel(active)} ${active.id} moved over ${over.id}.`
      : `${dragItemLabel(active)} ${active.id} left drop area.`
  },
  onDragEnd({ active, over }) {
    return over
      ? `${dragItemLabel(active)} ${active.id} dropped over ${over.id}.`
      : `${dragItemLabel(active)} ${active.id} dropped.`
  },
  onDragCancel({ active }) {
    return `Dragging ${dragItemLabel(active)} ${active.id} was cancelled.`
  },
}
