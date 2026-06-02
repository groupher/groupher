import type { Announcements } from '@dnd-kit/core'

import { DEFAULT_DOC_FAQ_FLAT, DEFAULT_DOC_FAQ_GROUPED } from '~/stores/dashboard/constant'

import {
  DEFAULT_GROUP_ID,
  DEFAULT_GROUP_TITLE,
  DUPLICATE_TITLE_SUFFIX,
  FAQ_DND_TYPE,
  UNTITLED_GROUP_TITLE,
  UNTITLED_ITEM_TITLE,
} from './constant'
import { normalizeFaqGroups } from './model'
import type { TFaqEditorGroup, TFaqEditorItem } from './spec'

let nextId = 0

type TDragActive = Parameters<NonNullable<Announcements['onDragStart']>>[0]['active']

const makeFaqId = (prefix: string): string => {
  nextId += 1
  return `${prefix}-${Date.now()}-${nextId}`
}

const dragItemLabel = (active: TDragActive): string =>
  active.data.current?.type === FAQ_DND_TYPE.SORTABLE_GROUP ? 'FAQ group' : 'FAQ item'

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

export const cloneDocFaqTemplate = (grouped: boolean) => ({
  ...(grouped ? DEFAULT_DOC_FAQ_GROUPED : DEFAULT_DOC_FAQ_FLAT),
  groups: (grouped ? DEFAULT_DOC_FAQ_GROUPED.groups : DEFAULT_DOC_FAQ_FLAT.groups).map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  })),
})

export const createFaqGroup = (): TFaqEditorGroup => ({
  id: makeFaqId('grp'),
  title: UNTITLED_GROUP_TITLE,
  index: 0,
  items: [],
})

export const createFaqItem = (): TFaqEditorItem => ({
  id: makeFaqId('faq'),
  title: UNTITLED_ITEM_TITLE,
  detail: 'Write a helpful markdown answer here.',
  index: 0,
})

export const duplicateFaqItem = (item: TFaqEditorItem): TFaqEditorItem => ({
  ...item,
  id: makeFaqId('faq'),
  title: `${item.title || UNTITLED_ITEM_TITLE} ${DUPLICATE_TITLE_SUFFIX}`,
})

export const ensureFlatFaqGroup = (
  groups: readonly TFaqEditorGroup[],
): readonly TFaqEditorGroup[] => {
  const firstGroup = groups[0]

  if (!firstGroup) return cloneDocFaqTemplate(false).groups

  return normalizeFaqGroups([
    {
      id: DEFAULT_GROUP_ID,
      title: DEFAULT_GROUP_TITLE,
      index: 0,
      items: groups.flatMap((group) => group.items),
    },
  ])
}
