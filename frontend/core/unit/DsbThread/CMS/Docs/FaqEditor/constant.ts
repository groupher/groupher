import { MeasuringStrategy } from '@dnd-kit/core'

import CategorySVG from '~/icons/Category'
import ListBulletsSVG from '~/icons/ListBullets'

export const FAQ_MODE = {
  GROUPED: 'grouped',
  FLAT: 'flat',
} as const

export const FAQ_SAVE_ZONE = {
  TITLE: 'title',
  DESC: 'desc',
  GROUP_TITLE: 'groupTitle',
  ITEM_TITLE: 'itemTitle',
  ITEM_DETAIL: 'itemDetail',
  MODE: 'mode',
  LIST_ORDER: 'listOrder',
} as const

export const FAQ_GROUP_MENU_ACTION = {
  ADD: 'add',
  RENAME: 'rename',
  DELETE: 'delete',
} as const

export const FAQ_ITEM_MENU_ACTION = {
  RENAME: 'rename',
  DUPLICATE: 'duplicate',
  DELETE: 'delete',
} as const

export const FAQ_EDITOR_COPY = {
  MODE_GROUPED: 'Grouped',
  MODE_FLAT: 'Flat',
  MODE_ARIA_LABEL: 'FAQ display mode',
  ADD_GROUP: 'Add group',
  ADD_ITEM: 'Add item',
  RENAME: 'Rename',
  DUPLICATE: 'Duplicate',
  DELETE: 'Delete',
  GROUP_ACTIONS_ARIA_LABEL: 'FAQ group actions',
  ITEM_ACTIONS_ARIA_LABEL: 'FAQ item actions',
  EDIT_GROUP_TITLE_ARIA_LABEL: 'Edit FAQ group title',
  DRAG_GROUP_ARIA_LABEL: 'Drag FAQ group',
  DRAG_ITEM_ARIA_LABEL: 'Drag FAQ item',
  EDIT_TEXT_ARIA_LABEL: 'Edit FAQ text',
  EXPAND_ITEM_ARIA_LABEL: 'Expand FAQ item',
  COLLAPSE_ITEM_ARIA_LABEL: 'Collapse FAQ item',
} as const

export const FAQ_MODE_ITEMS = [
  { key: FAQ_MODE.GROUPED, label: FAQ_EDITOR_COPY.MODE_GROUPED, icon: CategorySVG },
  { key: FAQ_MODE.FLAT, label: FAQ_EDITOR_COPY.MODE_FLAT, icon: ListBulletsSVG },
] as const

export const FAQ_DND_TYPE = {
  ITEM: 'doc-faq-item',
  GROUP: 'doc-faq-group',
  SORTABLE_GROUP: 'doc-faq-sortable-group',
} as const

export const FAQ_DND_CONTEXT_ID = 'dashboard-doc-faq-dnd'
export const FAQ_SORTABLE_GROUP_ID_PREFIX = 'doc-faq-sortable-group'

export const DND_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
}
