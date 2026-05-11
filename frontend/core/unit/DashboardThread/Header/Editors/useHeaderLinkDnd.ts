import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { THeaderLinkItem } from '~/spec'

import {
  buildHeaderColumns,
  findColumnWithLink,
  flattenHeaderColumns,
  moveHeaderLinkInColumns,
  sameHeaderLinks,
} from './model'
import type { THeaderColumn, THeaderDragTarget } from './spec'

type TProps = {
  links: readonly THeaderLinkItem[]
  community: string
  onCommit: (links: readonly THeaderLinkItem[]) => void
}

type TRet = {
  columns: THeaderColumn[]
  findColumnWithLink: (itemId: string) => ReturnType<typeof findColumnWithLink>
  startDrag: (itemId: string) => void
  moveDrag: (target?: THeaderDragTarget | null) => void
  commitDrag: (target?: THeaderDragTarget | null) => void
  cancelDrag: () => void
}

// Keeps a local column draft while dragging header links. The draft updates during
// cross-group hover, then commits once on drop to avoid expensive parent updates.
export default function useHeaderLinkDnd({ links, community, onCommit }: TProps): TRet {
  const sourceColumns = useMemo(() => buildHeaderColumns(links, community), [community, links])
  const [columns, setColumns] = useState<THeaderColumn[]>(sourceColumns)
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

  const moveDrag = useCallback((target?: THeaderDragTarget | null): void => {
    const activeId = activeIdRef.current
    if (!activeId || !target?.columnId) return

    const currentColumns = latestColumnsRef.current
    const source = findColumnWithLink(currentColumns, activeId)
    if (!source || source.column.id === target.columnId) return

    const nextColumns = moveHeaderLinkInColumns(currentColumns, activeId, target)
    if (sameHeaderLinks(flattenHeaderColumns(currentColumns), flattenHeaderColumns(nextColumns))) {
      return
    }

    latestColumnsRef.current = nextColumns
    setColumns(nextColumns)
  }, [])

  const commitDrag = useCallback(
    (target?: THeaderDragTarget | null): void => {
      const activeId = activeIdRef.current
      const currentColumns = latestColumnsRef.current
      const nextColumns =
        activeId && target
          ? moveHeaderLinkInColumns(currentColumns, activeId, target)
          : currentColumns

      activeIdRef.current = null
      draggingRef.current = false

      if (
        !sameHeaderLinks(flattenHeaderColumns(currentColumns), flattenHeaderColumns(nextColumns))
      ) {
        latestColumnsRef.current = nextColumns
        setColumns(nextColumns)
      }

      const baselineLinks = flattenHeaderColumns(baselineColumnsRef.current)
      const nextLinks = flattenHeaderColumns(nextColumns)
      if (sameHeaderLinks(baselineLinks, nextLinks)) return

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
