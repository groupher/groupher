import { arrayMove } from '@dnd-kit/sortable'

import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import type { TFooterOnelineLink, TLinkChild, TLinkItem } from '~/spec'

import { isValidDashboardLink, isValidDashboardLinks, toDraftLink } from '../../LinkEditor/model'
import type { TFooterColumn, TFooterDraftLink, TFooterDragTarget } from './spec'

const FOOTER_ONELINE_GROUP_ID = 'footer-oneline-links'
const FOOTER_ONELINE_GROUP_TITLE = 'Links'

export const isValidFooterLink = isValidDashboardLink
export const isValidFooterLinks = isValidDashboardLinks

// Public footer rendering is fed from dashboard state, which can briefly contain
// partial editor drafts. Treat empty title/url strings as valid draft values so
// a newly added oneline link stays editable instead of being filtered out.
export const isValidFooterOnelineLink = (link: TFooterOnelineLink): boolean =>
  Boolean(link.id) && typeof link.title === 'string' && typeof link.url === 'string'
export const isValidFooterOnelineLinks = (links: readonly TFooterOnelineLink[]): boolean =>
  links.every(isValidFooterOnelineLink)

const toDndId = (groupId: string, link: TLinkChild): string => `footer-link:${groupId}:${link.id}`

export { toDraftLink }

// The oneline footer is persisted as a flat link list, while the shared link
// editor works on group-shaped TLinkItem data. This adapter creates one
// non-persisted group so oneline can reuse item editing and item sorting without
// inheriting footer group editing semantics.
export const buildFooterOnelineDraftLinks = (
  links: readonly TFooterOnelineLink[],
): readonly TLinkItem[] => [
  {
    id: FOOTER_ONELINE_GROUP_ID,
    type: DASHBOARD_LINK_TYPE.GROUP,
    title: FOOTER_ONELINE_GROUP_TITLE,
    links,
  },
]

// Converts the one-group oneline editor draft back to the persisted flat list.
// The synthetic group id/title are intentionally discarded here.
export const flattenFooterOnelineDraftLinks = (
  links: readonly TLinkItem[],
): readonly TFooterOnelineLink[] => {
  const group = links[0]

  if (!group || group.type !== DASHBOARD_LINK_TYPE.GROUP) return []

  return group.links.filter(isValidFooterOnelineLink)
}

// Converts persisted grouped footer links into DnD columns. Footer group layout
// only supports real groups, so non-group records are ignored instead of being
// coerced.
export const buildFooterColumns = (links: readonly TLinkItem[]): TFooterColumn[] => {
  if (!isValidFooterLinks(links)) return []

  return links
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .filter(({ item }) => item.type === DASHBOARD_LINK_TYPE.GROUP)
    .map(({ item: group, sourceIndex }) => ({
      id: group.id,
      title: group.title,
      sourceIndex,
      links: group.links.map(
        (link): TFooterDraftLink => ({
          ...link,
          dndId: toDndId(group.id, link),
        }),
      ),
    }))
}

// Serializes footer DnD columns back to the backend shape and strips the
// per-group dndId used only to disambiguate duplicate child ids across groups.
export const flattenFooterColumns = (columns: readonly TFooterColumn[]): TLinkItem[] => {
  return columns.map(
    (column): TLinkItem => ({
      id: column.id,
      type: DASHBOARD_LINK_TYPE.GROUP,
      title: column.title,
      links: column.links.map(({ dndId: _dndId, ...link }) => link),
    }),
  )
}

export const sameFooterLinks = (left: readonly TLinkItem[], right: readonly TLinkItem[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

const normalizeColumnIndexes = (columns: readonly TFooterColumn[]): TFooterColumn[] =>
  columns.map((column, sourceIndex) => ({ ...column, sourceIndex }))

export const findColumnWithLink = (
  columns: readonly TFooterColumn[],
  itemId: string,
): { column: TFooterColumn; link: TFooterDraftLink } | null => {
  for (const column of columns) {
    const link = column.links.find((item) => item.dndId === itemId)
    if (link) return { column, link }
  }

  return null
}

// Moves a link inside the local column draft. The source column may become
// empty, but unlike header single-link columns it must remain present because
// every footer group is an explicit persisted group.
export const moveFooterLinkInColumns = (
  columns: readonly TFooterColumn[],
  itemId: string,
  target: TFooterDragTarget,
): TFooterColumn[] => {
  if (!target.columnId || target.itemId === itemId) return [...columns]

  const source = findColumnWithLink(columns, itemId)
  const targetColumn = columns.find((column) => column.id === target.columnId)

  if (!source || !targetColumn) return [...columns]

  const sourceColumn = source.column
  const sourceLinks = sourceColumn.links.filter((link) => link.dndId !== itemId)
  const targetBase =
    sourceColumn.id === targetColumn.id
      ? sourceLinks
      : targetColumn.links.filter((link) => link.dndId !== itemId)

  const targetIndex = target.itemId
    ? targetBase.findIndex((link) => link.dndId === target.itemId)
    : targetBase.length
  const insertIndex =
    targetIndex >= 0 ? targetIndex + (target.position === 'after' ? 1 : 0) : targetBase.length
  const boundedIndex = Math.max(0, Math.min(insertIndex, targetBase.length))
  const targetLinks = [
    ...targetBase.slice(0, boundedIndex),
    source.link,
    ...targetBase.slice(boundedIndex),
  ]

  return columns.map((column) => {
    if (column.id === sourceColumn.id && column.id !== targetColumn.id) {
      return { ...column, links: sourceLinks }
    }

    if (column.id === targetColumn.id) {
      return { ...column, links: targetLinks }
    }

    return column
  })
}

// Sorts persisted footer groups. Oneline mode does not call this because its
// synthetic group is only an editor adapter, not a draggable persisted group.
export const moveFooterColumn = (
  columns: readonly TFooterColumn[],
  columnId: string,
  targetColumnId: string,
): TFooterColumn[] => {
  if (columnId === targetColumnId) return [...columns]

  const activeIndex = columns.findIndex((column) => column.id === columnId)
  if (activeIndex < 0) return [...columns]

  const targetIndex = columns.findIndex((column) => column.id === targetColumnId)
  if (targetIndex < 0) return [...columns]

  return normalizeColumnIndexes(arrayMove([...columns], activeIndex, targetIndex))
}
