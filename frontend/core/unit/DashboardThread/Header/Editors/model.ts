import { arrayMove } from '@dnd-kit/sortable'

import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import { MORE_TAB } from '~/hooks/useHeaderLinks/constant'
import {
  isCustomMoreGroup,
  isMoreTabGroup,
  resolveHeaderLinks,
} from '~/hooks/useHeaderLinks/helper'
import type { TLinkChild, TLinkItem } from '~/spec'

import { toDraftLink } from '../../LinkEditor/model'
import { HEADER_COLUMN_KIND, MORE_TAB_FIXED_LINK_IDS } from './constants'
import type { THeaderColumn, THeaderDragTarget } from './spec'

export const toLinkItem = toDraftLink

// Header editing uses columns as the working model. A column may be a normal
// group, a special single-link group, or the fixed More group. The persisted
// shape is still the original TLinkItem list.
const placeMoreLast = (columns: readonly THeaderColumn[]): THeaderColumn[] => {
  const moreColumns = columns.filter((column) => column.kind === HEADER_COLUMN_KIND.MORE)
  const regularColumns = columns.filter((column) => column.kind !== HEADER_COLUMN_KIND.MORE)

  // This is a view-only placement rule. Keep sourceIndex tied to the persisted
  // array so group edit/delete actions still target the original item.
  return [...regularColumns, ...moreColumns]
}

// Builds the editor-only column model from persisted header links. Single links
// become one-link columns so they can be sorted alongside groups; More is kept
// as the last non-sortable column and may also show fixed resolver links.
export const buildHeaderColumns = (
  links: readonly TLinkItem[],
  community: string,
): THeaderColumn[] => {
  const columns = links.map<THeaderColumn>((item, sourceIndex) => {
    if (item.type === DASHBOARD_LINK_TYPE.LINK) {
      return {
        id: item.id,
        kind: HEADER_COLUMN_KIND.LINK,
        title: item.title,
        sourceIndex,
        links: [{ id: item.id, title: item.title, url: item.url }],
        fixedLinks: [],
      }
    }

    const isMore = isCustomMoreGroup(item)

    return {
      id: isMore ? MORE_TAB.CUSTOM_ID : item.id,
      kind: isMore ? HEADER_COLUMN_KIND.MORE : HEADER_COLUMN_KIND.GROUP,
      title: isMore ? MORE_TAB.TITLE_KEY : item.title,
      sourceIndex,
      links: [...item.links],
      fixedLinks: [],
    }
  })

  const moreTab = resolveHeaderLinks(links, community).find(isMoreTabGroup)
  const fixedMoreTabLinks =
    moreTab?.links.filter((link) => MORE_TAB_FIXED_LINK_IDS.has(link.id)) ?? []

  if (fixedMoreTabLinks.length === 0) return placeMoreLast(columns)

  const moreColumn = columns.find((column) => column.kind === HEADER_COLUMN_KIND.MORE)
  if (moreColumn) {
    return placeMoreLast(
      columns.map((column) =>
        column.id === moreColumn.id ? { ...column, fixedLinks: fixedMoreTabLinks } : column,
      ),
    )
  }

  // The editor shows fixed More tab links as read-only children, but
  // flattenHeaderColumns strips them so usage: more-tab is never persisted.
  return placeMoreLast([
    ...columns,
    {
      id: MORE_TAB.CUSTOM_ID,
      kind: HEADER_COLUMN_KIND.MORE,
      title: MORE_TAB.TITLE_KEY,
      sourceIndex: links.length,
      links: [],
      fixedLinks: fixedMoreTabLinks,
    },
  ])
}

// Converts header columns back to persisted links. Empty single-link columns are
// dropped, which is how dragging a header single link into another group removes
// the source single-link column. Fixed More links are never persisted.
export const flattenHeaderColumns = (columns: readonly THeaderColumn[]): TLinkItem[] => {
  return columns.flatMap((column): TLinkItem[] => {
    if (column.kind === HEADER_COLUMN_KIND.LINK) {
      const link = column.links[0]
      if (!link) return []

      return [{ id: link.id, type: DASHBOARD_LINK_TYPE.LINK, title: link.title, url: link.url }]
    }

    if (column.kind === HEADER_COLUMN_KIND.MORE && column.links.length === 0) return []

    return [
      {
        id: column.kind === HEADER_COLUMN_KIND.MORE ? MORE_TAB.CUSTOM_ID : column.id,
        type: DASHBOARD_LINK_TYPE.GROUP,
        title: column.kind === HEADER_COLUMN_KIND.MORE ? MORE_TAB.TITLE_KEY : column.title,
        links: column.links,
      },
    ]
  })
}

export const sameHeaderLinks = (left: readonly TLinkItem[], right: readonly TLinkItem[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

function normalizeColumnIndexes(columns: readonly THeaderColumn[]): THeaderColumn[] {
  return columns.map((column, sourceIndex) => ({ ...column, sourceIndex }))
}

const isSortableColumn = (column: THeaderColumn): boolean =>
  column.kind === HEADER_COLUMN_KIND.LINK || column.kind === HEADER_COLUMN_KIND.GROUP

// Link sorting is only allowed into group/More columns. Single-link columns are
// sortable as whole columns, but they do not accept child links.
export const findColumnWithLink = (
  columns: readonly THeaderColumn[],
  itemId: string,
): { column: THeaderColumn; link: TLinkChild } | null => {
  for (const column of columns) {
    const link = column.links.find((item) => item.id === itemId)
    if (link) return { column, link }
  }

  return null
}

// Moves a link in the column draft. When the source is a single-link column and
// the link is dragged into another group, the source column is removed from the
// draft and therefore from the eventual persisted header links.
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

// Sorts only movable header columns. The More column and any other fixed column
// stay out of the sortable set and are appended after the reordered columns.
export const moveHeaderColumn = (
  columns: readonly THeaderColumn[],
  columnId: string,
  targetColumnId: string,
): THeaderColumn[] => {
  if (columnId === targetColumnId) return [...columns]

  const sortableColumns = columns.filter(isSortableColumn)
  const fixedColumns = columns.filter((column) => !isSortableColumn(column))
  const activeIndex = sortableColumns.findIndex((column) => column.id === columnId)
  if (activeIndex < 0) return [...columns]

  const targetIndex = sortableColumns.findIndex((column) => column.id === targetColumnId)
  if (targetIndex < 0) return [...columns]

  return normalizeColumnIndexes([
    ...arrayMove(sortableColumns, activeIndex, targetIndex),
    ...fixedColumns,
  ])
}
