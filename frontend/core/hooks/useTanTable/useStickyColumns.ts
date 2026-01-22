// ~/hooks/useStickyColumns.ts
'use client'

import type { Table } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { SELECT_COL_ID, SELECT_COL_WIDTH } from './useMultiSelection'

type StickySide = 'left' | 'right' | false

type StickyProps = {
  className: string
  style: React.CSSProperties
  pinned: StickySide
  isHidden: boolean
}

type StickyOptions = {
  showSelectColumn?: boolean
}

/**
 * Sticky columns helper driven by ColumnDef.meta.sticky.
 *
 * Key point:
 * - When showSelectColumn=false, treat SELECT_COL_ID as effective width 0
 *   so offsets for other sticky-left columns don't leave a blank gap.
 */
export function useStickyColumns<TData>(table: Table<TData>, options?: StickyOptions) {
  const showSelectColumn = options?.showSelectColumn ?? true

  // Important: use visible leaf columns (matches your actual rendering via getVisibleCells/headerGroups)
  const leafCols = table.getVisibleLeafColumns()

  const { widthMap, sideMap, leftOffset, rightOffset } = useMemo(() => {
    const widthMap = new Map<string, number>()
    const sideMap = new Map<string, StickySide>()

    // 1) effective widths
    for (const col of leafCols) {
      let width = col.getSize()

      // select column is collapsed logically when toggled off
      if (col.id === SELECT_COL_ID) {
        width = showSelectColumn ? SELECT_COL_WIDTH : 0
      }

      widthMap.set(col.id, Math.max(0, Number(width) || 0))
    }

    // 2) sticky side from ColumnDef.meta.sticky
    for (const col of leafCols) {
      const sticky = col.columnDef.meta?.sticky as StickySide | undefined
      sideMap.set(col.id, sticky ?? false)
    }

    // 3) left offsets (prefix sum of pinned-left effective widths)
    const leftOffset = new Map<string, number>()
    let accLeft = 0
    for (const col of leafCols) {
      if (sideMap.get(col.id) === 'left') {
        leftOffset.set(col.id, accLeft)
        accLeft += widthMap.get(col.id) ?? 0
      }
    }

    // 4) right offsets (suffix sum of pinned-right effective widths)
    const rightOffset = new Map<string, number>()
    let accRight = 0
    for (let i = leafCols.length - 1; i >= 0; i--) {
      const col = leafCols[i]!
      if (sideMap.get(col.id) === 'right') {
        rightOffset.set(col.id, accRight)
        accRight += widthMap.get(col.id) ?? 0
      }
    }

    return { widthMap, sideMap, leftOffset, rightOffset }
  }, [leafCols, showSelectColumn])

  const build = useCallback(
    (kind: 'header' | 'body', colId: string): StickyProps => {
      const width = widthMap.get(colId) ?? 0
      const pinned = sideMap.get(colId) ?? false
      const isHidden = width === 0

      // Keep width inline for layout; for select column you already override it by CSS !important.
      const style: React.CSSProperties = { width, overflow: 'hidden' }
      const classParts: string[] = []

      if (!pinned) {
        return { pinned: false, isHidden, style, className: classParts.join(' ') }
      }

      style.position = 'sticky'
      classParts.push('bg-white')
      classParts.push(kind === 'header' ? 'z-30' : 'z-20')

      if (pinned === 'left') {
        style.left = leftOffset.get(colId) ?? 0
        if (!isHidden) classParts.push('shadow-[2px_0_0_0_rgba(0,0,0,0.06)]')
      } else {
        style.right = rightOffset.get(colId) ?? 0
        if (!isHidden) classParts.push('shadow-[-2px_0_0_0_rgba(0,0,0,0.06)]')
      }

      return { pinned, isHidden, style, className: classParts.join(' ') }
    },
    [leftOffset, rightOffset, sideMap, widthMap],
  )

  return {
    header: (colId: string) => build('header', colId),
    cell: (colId: string) => build('body', colId),
  }
}
