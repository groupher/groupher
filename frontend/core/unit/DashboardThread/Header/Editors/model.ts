import {
  CUSTOM_MORE_ID,
  isCustomMoreGroup,
  resolveHeaderLinks,
} from '~/hooks/useHeaderLinks/helper'
import type { THeaderLinkChild, THeaderLinkItem, TLinkItem } from '~/spec'

import { HEADER_COLUMN_KIND, SYSTEM_LINK_IDS } from './constants'
import type { THeaderColumn, THeaderDragTarget } from './spec'

export type TMoveDir = 'up' | 'down' | 'top' | 'bottom'

export const toLinkItem = (
  link: Pick<THeaderLinkChild, 'title' | 'url'>,
  group: string,
  groupIndex: number,
  index: number,
): TLinkItem => ({
  index,
  title: link.title,
  link: link.url,
  group,
  groupIndex,
})

export const buildHeaderColumns = (
  links: readonly THeaderLinkItem[],
  community: string,
): THeaderColumn[] => {
  const columns = links.map<THeaderColumn>((item, sourceIndex) => {
    if (item.type === 'LINK') {
      return {
        id: item.id,
        kind: HEADER_COLUMN_KIND.LINK,
        title: item.title,
        sourceIndex,
        links: [{ id: item.id, title: item.title, url: item.url }],
        systemLinks: [],
      }
    }

    const isMore = isCustomMoreGroup(item)

    return {
      id: isMore ? CUSTOM_MORE_ID : item.id,
      kind: isMore ? HEADER_COLUMN_KIND.MORE : HEADER_COLUMN_KIND.GROUP,
      title: isMore ? '更多' : item.title,
      sourceIndex,
      links: [...item.links],
      systemLinks: [],
    }
  })

  const systemMore = resolveHeaderLinks(links, community).find(
    (item) => item.type === 'system-group',
  )
  const systemLinks = systemMore?.links.filter((link) => SYSTEM_LINK_IDS.has(link.id)) ?? []

  if (systemLinks.length === 0) return columns

  const moreColumn = columns.find((column) => column.kind === HEADER_COLUMN_KIND.MORE)
  if (moreColumn) {
    return columns.map((column) =>
      column.id === moreColumn.id ? { ...column, systemLinks } : column,
    )
  }

  return [
    ...columns,
    {
      id: CUSTOM_MORE_ID,
      kind: HEADER_COLUMN_KIND.MORE,
      title: '更多',
      sourceIndex: links.length,
      links: [],
      systemLinks,
    },
  ]
}

export const flattenHeaderColumns = (columns: readonly THeaderColumn[]): THeaderLinkItem[] => {
  return columns.flatMap((column): THeaderLinkItem[] => {
    if (column.kind === HEADER_COLUMN_KIND.LINK) {
      const link = column.links[0]
      if (!link) return []

      return [{ id: link.id, type: 'LINK', title: link.title, url: link.url }]
    }

    if (column.kind === HEADER_COLUMN_KIND.MORE && column.links.length === 0) return []

    return [
      {
        id: column.kind === HEADER_COLUMN_KIND.MORE ? CUSTOM_MORE_ID : column.id,
        type: 'GROUP',
        title: column.kind === HEADER_COLUMN_KIND.MORE ? '更多' : column.title,
        links: column.links,
      },
    ]
  })
}

export const sameHeaderLinks = (
  left: readonly THeaderLinkItem[],
  right: readonly THeaderLinkItem[],
): boolean => JSON.stringify(left) === JSON.stringify(right)

export const findColumnWithLink = (
  columns: readonly THeaderColumn[],
  itemId: string,
): { column: THeaderColumn; link: THeaderLinkChild } | null => {
  for (const column of columns) {
    const link = column.links.find((item) => item.id === itemId)
    if (link) return { column, link }
  }

  return null
}

export const moveHeaderLinkInColumns = (
  columns: readonly THeaderColumn[],
  itemId: string,
  target: THeaderDragTarget,
): THeaderColumn[] => {
  if (!target.columnId || target.itemId === itemId) return [...columns]

  const source = findColumnWithLink(columns, itemId)
  const targetColumn = columns.find((column) => column.id === target.columnId)

  if (!source || !targetColumn || targetColumn.kind === HEADER_COLUMN_KIND.LINK) return [...columns]

  const sourceColumn = source.column
  const sourceLinks = sourceColumn.links.filter((link) => link.id !== itemId)
  const targetBase =
    sourceColumn.id === targetColumn.id
      ? sourceLinks
      : targetColumn.links.filter((link) => link.id !== itemId)

  const targetIndex = target.itemId
    ? targetBase.findIndex((link) => link.id === target.itemId)
    : targetBase.length
  const insertIndex =
    targetIndex >= 0 ? targetIndex + (target.position === 'after' ? 1 : 0) : targetBase.length
  const boundedIndex = Math.max(0, Math.min(insertIndex, targetBase.length))
  const targetLinks = [
    ...targetBase.slice(0, boundedIndex),
    source.link,
    ...targetBase.slice(boundedIndex),
  ]

  return columns.flatMap((column): THeaderColumn[] => {
    if (column.id === sourceColumn.id && column.id !== targetColumn.id) {
      if (column.kind === HEADER_COLUMN_KIND.LINK) return []
      return [{ ...column, links: sourceLinks }]
    }

    if (column.id === targetColumn.id) {
      return [{ ...column, links: targetLinks }]
    }

    return [column]
  })
}

export const move = <T>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export const moveTo = <T>(items: readonly T[], from: number, dir: TMoveDir): T[] => {
  if (items.length <= 1) return [...items]

  const to =
    dir === 'top' ? 0 : dir === 'bottom' ? items.length - 1 : dir === 'up' ? from - 1 : from + 1

  if (to < 0 || to >= items.length || to === from) return [...items]

  return move(items, from, to)
}
