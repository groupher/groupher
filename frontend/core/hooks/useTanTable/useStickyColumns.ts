// ~/hooks/useStickyColumns.ts
'use client'

import type { Table } from '@tanstack/react-table'
import { useMemo } from 'react'
import useTwBelt from '~/hooks/useTwBelt'
import type {} from '../../spec/tantable'
import { SELECT_COL_ID, SELECT_COL_WIDTH } from './useMultiSelection'

type StickySide = 'left' | 'right' | false

type TStickyProps = {
  className: string
  style: React.CSSProperties
}

type TStickyOptions = {
  showSelectColumn?: boolean
}

export function useStickyColumns<TData>(table: Table<TData>, options?: TStickyOptions) {
  const { bg, zIndex } = useTwBelt()
  const showSelectColumn = options?.showSelectColumn ?? true

  const leafCols = table.getVisibleLeafColumns()

  const layoutKey = leafCols.map((c) => `${c.id}:${c.getSize()}`).join('|')

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const { headerProps, bodyProps } = useMemo(() => {
    const widthMap = new Map<string, number>()
    const sideMap = new Map<string, StickySide>()

    for (const col of leafCols) {
      sideMap.set(col.id, (col.columnDef.meta?.sticky as StickySide | undefined) ?? false)

      let width = col.getSize()
      if (col.id === SELECT_COL_ID) width = showSelectColumn ? SELECT_COL_WIDTH : 0
      widthMap.set(col.id, Math.max(0, Number(width) || 0))
    }

    const leftOffset = new Map<string, number>()
    let accLeft = 0
    for (const col of leafCols) {
      if (sideMap.get(col.id) === 'left') {
        leftOffset.set(col.id, accLeft)
        accLeft += widthMap.get(col.id) ?? 0
      }
    }

    const rightOffset = new Map<string, number>()
    let accRight = 0
    for (let i = leafCols.length - 1; i >= 0; i--) {
      const col = leafCols[i]
      if (!col) continue
      if (sideMap.get(col.id) === 'right') {
        rightOffset.set(col.id, accRight)
        accRight += widthMap.get(col.id) ?? 0
      }
    }

    const mk = (kind: 'header' | 'body', colId: string): TStickyProps => {
      const width = widthMap.get(colId) ?? 0
      const pinned = sideMap.get(colId) ?? false

      const style: React.CSSProperties = { width }

      if (!pinned) return { className: '', style }

      style.position = 'sticky'
      const classParts: string[] = [bg('pageBg')]
      if (kind === 'header') classParts.push(zIndex('tableStickyColumn'))

      if (pinned === 'left') {
        style.left = leftOffset.get(colId) ?? 0
        classParts.push('sticky-column-left')
      } else {
        style.right = rightOffset.get(colId) ?? 0
        classParts.push('sticky-column-right')
      }

      return { className: classParts.join(' '), style }
    }

    const headerProps = new Map<string, TStickyProps>()
    const bodyProps = new Map<string, TStickyProps>()
    for (const col of leafCols) {
      headerProps.set(col.id, mk('header', col.id))
      bodyProps.set(col.id, mk('body', col.id))
    }

    return { headerProps, bodyProps }
  }, [layoutKey, showSelectColumn])

  const empty: TStickyProps = { className: '', style: {} }

  return {
    header: (colId: string) => headerProps.get(colId) ?? empty,
    cell: (colId: string) => bodyProps.get(colId) ?? empty,
  }
}
