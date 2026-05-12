import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { TLinkItem } from '~/spec'

import {
  buildFooterColumns,
  findColumnWithLink,
  flattenFooterColumns,
  moveFooterLinkInColumns,
  sameFooterLinks,
} from './model'
import type { TFooterColumn, TFooterDragTarget } from './spec'

type TProps = {
  links: readonly TLinkItem[]
  onCommit: (links: readonly TLinkItem[]) => void
}

type TRet = {
  columns: TFooterColumn[]
  findColumnWithLink: (itemId: string) => ReturnType<typeof findColumnWithLink>
  startDrag: (itemId: string) => void
  moveDrag: (target?: TFooterDragTarget | null) => void
  commitDrag: (target?: TFooterDragTarget | null) => void
  cancelDrag: () => void
}

export default function useFooterLinkDnd({ links, onCommit }: TProps): TRet {
  const sourceColumns = useMemo(() => buildFooterColumns(links), [links])
  const [columns, setColumns] = useState<TFooterColumn[]>(sourceColumns)
  const latestColumnsRef = useRef(columns)
  const baselineColumnsRef = useRef(columns)
  const activeIdRef = useRef<string | null>(null)
  const draggingRef = useRef(false)
  const commitFrameRef = useRef<number | null>(null)

  useEffect(() => {
    latestColumnsRef.current = columns
  }, [columns])

  useEffect(() => {
    if (draggingRef.current) return
    baselineColumnsRef.current = sourceColumns
    setColumns(sourceColumns)
  }, [sourceColumns])

  useEffect(() => {
    return () => {
      if (commitFrameRef.current) cancelAnimationFrame(commitFrameRef.current)
    }
  }, [])

  const findColumn = useCallback(
    (itemId: string) => findColumnWithLink(latestColumnsRef.current, itemId),
    [],
  )

  const startDrag = useCallback((itemId: string): void => {
    activeIdRef.current = itemId
    draggingRef.current = true
    baselineColumnsRef.current = latestColumnsRef.current
  }, [])

  const moveDrag = useCallback((target?: TFooterDragTarget | null): void => {
    const activeId = activeIdRef.current
    if (!activeId || !target?.columnId) return

    const currentColumns = latestColumnsRef.current
    const source = findColumnWithLink(currentColumns, activeId)
    if (!source || source.column.id === target.columnId) return

    const nextColumns = moveFooterLinkInColumns(currentColumns, activeId, target)
    if (sameFooterLinks(flattenFooterColumns(currentColumns), flattenFooterColumns(nextColumns))) {
      return
    }

    latestColumnsRef.current = nextColumns
    setColumns(nextColumns)
  }, [])

  const commitDrag = useCallback(
    (target?: TFooterDragTarget | null): void => {
      const activeId = activeIdRef.current
      const currentColumns = latestColumnsRef.current
      const nextColumns =
        activeId && target
          ? moveFooterLinkInColumns(currentColumns, activeId, target)
          : currentColumns

      activeIdRef.current = null
      draggingRef.current = false

      if (
        !sameFooterLinks(flattenFooterColumns(currentColumns), flattenFooterColumns(nextColumns))
      ) {
        latestColumnsRef.current = nextColumns
        setColumns(nextColumns)
      }

      const baselineLinks = flattenFooterColumns(baselineColumnsRef.current)
      const nextLinks = flattenFooterColumns(nextColumns)
      if (sameFooterLinks(baselineLinks, nextLinks)) return

      if (commitFrameRef.current) cancelAnimationFrame(commitFrameRef.current)
      commitFrameRef.current = requestAnimationFrame(() => {
        onCommit(nextLinks)
        commitFrameRef.current = null
      })
    },
    [onCommit],
  )

  const cancelDrag = useCallback((): void => {
    activeIdRef.current = null
    draggingRef.current = false
    latestColumnsRef.current = baselineColumnsRef.current
    setColumns(baselineColumnsRef.current)
  }, [])

  return {
    columns,
    findColumnWithLink: findColumn,
    startDrag,
    moveDrag,
    commitDrag,
    cancelDrag,
  }
}
