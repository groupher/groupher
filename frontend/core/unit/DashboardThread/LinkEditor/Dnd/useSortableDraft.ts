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
  sameLinks: (left: readonly TOutput[], right: readonly TOutput[]) => boolean
  onCommit: (links: readonly TOutput[]) => void
}

type TRet<TColumn extends TLinkDndColumnBase, TLink, TTarget extends TLinkDndTarget> = {
  columns: TColumn[]
  findColumnWithLink: (itemId: string) => TLinkDndColumnResult<TColumn, TLink> | null
  startDrag: (itemId: string) => void
  moveDrag: (target?: TTarget | null) => void
  commitDrag: (target?: TTarget | null) => void
  cancelDrag: () => void
}

// Keeps a local column draft while dragging links. The draft updates during
// cross-group hover, then commits once on drop to avoid expensive parent updates.
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
    [flattenColumns, moveLinkInColumns, onCommit, sameLinks],
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
