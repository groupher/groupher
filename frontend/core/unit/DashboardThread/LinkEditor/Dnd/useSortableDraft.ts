import { useCallback, useEffect, useRef, useState } from 'react'

import type { TLinkDndColumnBase, TLinkDndColumnResult, TLinkDndTarget } from './spec'

type TProps<TColumn extends TLinkDndColumnBase, TLink, TTarget extends TLinkDndTarget, TOutput> = {
  sourceColumns: readonly TColumn[]
  findColumnWithLink: (
    columns: readonly TColumn[],
    itemId: string,
  ) => TLinkDndColumnResult<TColumn, TLink> | null
  flattenColumns: (columns: readonly TColumn[]) => readonly TOutput[]
  moveLinkInColumns: (columns: readonly TColumn[], itemId: string, target: TTarget) => TColumn[]
  moveColumn?: (columns: readonly TColumn[], columnId: string, targetColumnId: string) => TColumn[]
  sameLinks: (left: readonly TOutput[], right: readonly TOutput[]) => boolean
  onCommit: (links: readonly TOutput[]) => void
}

type TRet<TColumn extends TLinkDndColumnBase, TLink, TTarget extends TLinkDndTarget> = {
  columns: TColumn[]
  findColumnWithLink: (itemId: string) => TLinkDndColumnResult<TColumn, TLink> | null
  startDrag: (itemId: string) => void
  startColumnDrag: (columnId: string) => void
  moveDrag: (target?: TTarget | null) => void
  commitDrag: (target?: TTarget | null) => void
  commitColumnDrag: (targetColumnId?: string | null) => void
  cancelDrag: () => void
}

// Shared draft controller for dashboard link editors.
//
// It keeps an editor-local column draft during DnD so cross-group hover feedback
// can update immediately without mutating dashboard state on every pointer move.
// The parent store is updated once on drop through `onCommit`. Header and footer
// provide their own adapters for building columns, moving links, moving columns,
// and flattening the draft back to the persisted shape.
export default function useSortableDraft<
  TColumn extends TLinkDndColumnBase,
  TLink,
  TTarget extends TLinkDndTarget,
  TOutput,
>({
  sourceColumns,
  findColumnWithLink,
  flattenColumns,
  moveLinkInColumns,
  moveColumn,
  sameLinks,
  onCommit,
}: TProps<TColumn, TLink, TTarget, TOutput>): TRet<TColumn, TLink, TTarget> {
  const [columns, setColumns] = useState<TColumn[]>([...sourceColumns])
  const latestColumnsRef = useRef<TColumn[]>(columns)
  const baselineColumnsRef = useRef<TColumn[]>(columns)
  const activeIdRef = useRef<string | null>(null)
  const draggingRef = useRef(false)
  const commitFrameRef = useRef<number | null>(null)

  useEffect(() => {
    latestColumnsRef.current = columns
  }, [columns])

  useEffect(() => {
    if (draggingRef.current) return

    const nextColumns = [...sourceColumns]
    baselineColumnsRef.current = nextColumns
    latestColumnsRef.current = nextColumns
    setColumns(nextColumns)
  }, [sourceColumns])

  useEffect(() => {
    return () => {
      if (commitFrameRef.current) cancelAnimationFrame(commitFrameRef.current)
    }
  }, [])

  const findColumn = useCallback(
    (itemId: string) => findColumnWithLink(latestColumnsRef.current, itemId),
    [findColumnWithLink],
  )

  const startDrag = useCallback((itemId: string): void => {
    activeIdRef.current = itemId
    draggingRef.current = true
    baselineColumnsRef.current = latestColumnsRef.current
  }, [])

  const startColumnDrag = useCallback((columnId: string): void => {
    activeIdRef.current = columnId
    draggingRef.current = true
    baselineColumnsRef.current = latestColumnsRef.current
  }, [])

  // Commits a finished draft once per animation frame. Both link dragging and
  // group/column dragging use the same commit path so touched-state and save-bar
  // behavior stays consistent.
  const commitColumns = useCallback(
    (nextColumns: TColumn[]): void => {
      const currentColumns = latestColumnsRef.current

      if (!sameLinks(flattenColumns(currentColumns), flattenColumns(nextColumns))) {
        latestColumnsRef.current = nextColumns
        setColumns(nextColumns)
      }

      const baselineLinks = flattenColumns(baselineColumnsRef.current)
      const nextLinks = flattenColumns(nextColumns)
      if (sameLinks(baselineLinks, nextLinks)) return

      if (commitFrameRef.current) cancelAnimationFrame(commitFrameRef.current)
      commitFrameRef.current = requestAnimationFrame(() => {
        onCommit(nextLinks)
        commitFrameRef.current = null
      })
    },
    [flattenColumns, onCommit, sameLinks],
  )

  const moveDrag = useCallback(
    (target?: TTarget | null): void => {
      const activeId = activeIdRef.current
      if (!activeId || !target?.columnId) return

      const currentColumns = latestColumnsRef.current
      const source = findColumnWithLink(currentColumns, activeId)
      if (!source || source.column.id === target.columnId) return

      const nextColumns = moveLinkInColumns(currentColumns, activeId, target)
      if (sameLinks(flattenColumns(currentColumns), flattenColumns(nextColumns))) return

      latestColumnsRef.current = nextColumns
      setColumns(nextColumns)
    },
    [findColumnWithLink, flattenColumns, moveLinkInColumns, sameLinks],
  )

  const commitDrag = useCallback(
    (target?: TTarget | null): void => {
      const activeId = activeIdRef.current
      const currentColumns = latestColumnsRef.current
      const nextColumns =
        activeId && target ? moveLinkInColumns(currentColumns, activeId, target) : currentColumns

      activeIdRef.current = null
      draggingRef.current = false

      commitColumns(nextColumns)
    },
    [commitColumns, moveLinkInColumns],
  )

  const commitColumnDrag = useCallback(
    (targetColumnId?: string | null): void => {
      const activeId = activeIdRef.current
      const currentColumns = latestColumnsRef.current
      const nextColumns =
        activeId && targetColumnId && moveColumn
          ? moveColumn(currentColumns, activeId, targetColumnId)
          : currentColumns

      activeIdRef.current = null
      draggingRef.current = false

      commitColumns(nextColumns)
    },
    [commitColumns, moveColumn],
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
    startColumnDrag,
    moveDrag,
    commitDrag,
    commitColumnDrag,
    cancelDrag,
  }
}
