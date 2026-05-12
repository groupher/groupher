import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import type { TLinkChild, TLinkItem } from '~/spec'

import { isValidDashboardLink, isValidDashboardLinks, toDraftLink } from '../../LinkEditor/model'
import type { TFooterColumn, TFooterDraftLink, TFooterDragTarget } from './spec'

export const isValidFooterLink = isValidDashboardLink
export const isValidFooterLinks = isValidDashboardLinks

const toDndId = (groupId: string, link: TLinkChild): string => `footer-link:${groupId}:${link.id}`

export { toDraftLink }

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
