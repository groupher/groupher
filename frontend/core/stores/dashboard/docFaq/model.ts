import type { TDocFaq, TDocFaqGroup, TDocFaqItem } from '~/spec'
import { DEFAULT_DOC_FAQ } from '~/stores/dashboard/constant'

import {
  DEFAULT_GROUP_ID,
  DEFAULT_GROUP_TITLE,
  DUPLICATE_TITLE_SUFFIX,
  UNTITLED_GROUP_TITLE,
  UNTITLED_ITEM_TITLE,
} from './constant'

let nextId = 0

const makeFaqId = (prefix: string): string => {
  nextId += 1
  return `${prefix}-${Date.now()}-${nextId}`
}

/**
 * Rewrites item indexes from the current array order before saving.
 */
export const normalizeFaqItems = (items: readonly TDocFaqItem[]): readonly TDocFaqItem[] =>
  items.map((item, itemIndex) => ({ ...item, index: itemIndex }))

/**
 * Rewrites group indexes and nested item indexes from the current array order.
 */
export const normalizeFaqGroups = (groups: readonly TDocFaqGroup[]): readonly TDocFaqGroup[] =>
  groups.map((group, groupIndex) => ({
    ...group,
    index: groupIndex,
    items: normalizeFaqItems(group.items),
  }))

/**
 * Normalizes both grouped and flat FAQ data before touching dashboard state.
 */
export const normalizeDocFaq = (docFaq: TDocFaq): TDocFaq => ({
  ...docFaq,
  groupItems: normalizeFaqGroups(docFaq.groupItems),
  flatItems: normalizeFaqItems(docFaq.flatItems),
})

/**
 * Compares normalized FAQ drafts against `original.docFaq` for save-zone cleanup.
 */
export const sameDocFaq = (left: TDocFaq, right: TDocFaq): boolean =>
  JSON.stringify(normalizeDocFaq(left)) === JSON.stringify(normalizeDocFaq(right))

/**
 * Adapts flat FAQ items into one temporary group for the shared group/item DnD UI.
 */
export const flatItemsToDisplayGroups = (docFaq: TDocFaq): readonly TDocFaqGroup[] => [
  {
    id: DEFAULT_GROUP_ID,
    title: DEFAULT_GROUP_TITLE,
    index: 0,
    items: docFaq.flatItems,
  },
]

/**
 * Returns the editor's render groups for the currently selected FAQ view.
 */
export const docFaqToDisplayGroups = (docFaq: TDocFaq): readonly TDocFaqGroup[] =>
  docFaq.groupedView ? docFaq.groupItems : flatItemsToDisplayGroups(docFaq)

/**
 * Clones the editable example FAQ so new/empty docs do not share object references.
 */
export const cloneDocFaqTemplate = (): TDocFaq => ({
  ...DEFAULT_DOC_FAQ,
  groupItems: DEFAULT_DOC_FAQ.groupItems.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  })),
  flatItems: DEFAULT_DOC_FAQ.flatItems.map((item) => ({ ...item })),
})

/**
 * Creates a new empty group for the grouped FAQ view.
 */
export const createFaqGroup = (): TDocFaqGroup => ({
  id: makeFaqId('grp'),
  title: UNTITLED_GROUP_TITLE,
  index: 0,
  items: [],
})

/**
 * Creates a new FAQ question with example markdown detail.
 */
export const createFaqItem = (): TDocFaqItem => ({
  id: makeFaqId('faq'),
  title: UNTITLED_ITEM_TITLE,
  detail: 'Write a helpful markdown answer here.',
  index: 0,
})

/**
 * Duplicates an item while assigning a new id and copy suffix.
 */
export const duplicateFaqItem = (item: TDocFaqItem): TDocFaqItem => ({
  ...item,
  id: makeFaqId('faq'),
  title: `${item.title || UNTITLED_ITEM_TITLE} ${DUPLICATE_TITLE_SUFFIX}`,
})
