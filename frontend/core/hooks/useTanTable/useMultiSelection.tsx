// ~/hooks/useMultiSelection.ts
'use client'

import type { ColumnDef, Row, Table } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import Checker from '~/widgets/Checker'

export const SELECT_COL_ID = 'select'
export const SELECT_COL_WIDTH = 44

export type MultiSelectionTableMeta = {
  selected: Set<string>
  toggleRow: (id: string, checked: boolean) => void
  toggleAll: (checked: boolean, ids: string[]) => void
  isAllSelected: (ids: string[]) => boolean
  isSomeSelected: (ids: string[]) => boolean
}

export function useMultiSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      // fast path: no-op guard (reduces re-render churn on repeated events)
      const has = prev.has(id)
      if ((checked && has) || (!checked && !has)) return prev

      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((checked: boolean, ids: string[]) => {
    setSelected((prev) => {
      if (ids.length === 0) return prev

      // fast path: avoid cloning when nothing changes
      if (checked) {
        let changed = false
        for (const id of ids) {
          if (!prev.has(id)) {
            changed = true
            break
          }
        }
        if (!changed) return prev
      } else {
        let changed = false
        for (const id of ids) {
          if (prev.has(id)) {
            changed = true
            break
          }
        }
        if (!changed) return prev
      }

      const next = new Set(prev)
      if (checked) {
        for (const id of ids) next.add(id)
      } else {
        for (const id of ids) next.delete(id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  // Keep these for external usage if you still want them,
  // but header will use a single-pass counter to avoid double traversal.
  const isAllSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected],
  )

  const isSomeSelected = useCallback(
    (ids: string[]) => ids.some((id) => selected.has(id)) && !isAllSelected(ids),
    [selected, isAllSelected],
  )

  const meta = useMemo<MultiSelectionTableMeta>(
    () => ({
      selected,
      toggleRow,
      toggleAll,
      isAllSelected,
      isSomeSelected,
    }),
    [selected, toggleRow, toggleAll, isAllSelected, isSomeSelected],
  )

  /**
   * ✅ IMPORTANT: this callback is stable (no deps),
   * so the ColumnDef identity stays stable across show/hide toggles.
   */
  const selectColumn = useCallback(<TData,>(): ColumnDef<TData, any> => {
    const getId = (row: Row<TData>) => row.id

    return {
      id: SELECT_COL_ID,
      size: SELECT_COL_WIDTH,
      enableSorting: false,
      meta: { sticky: 'left' },

      header: ({ table }: { table: Table<TData> }) => {
        const meta = table.options.meta as MultiSelectionTableMeta

        // rows are already current view (sorted/filtered); keep it local to avoid extra state
        const rows = table.getRowModel().rows as unknown as Row<TData>[]

        // single pass: build ids + count selected
        const ids: string[] = new Array(rows.length)
        let selectedCount = 0

        for (let i = 0; i < rows.length; i++) {
          const id = getId(rows[i]!)
          ids[i] = id
          if (meta.selected.has(id)) selectedCount++
        }

        const all = rows.length > 0 && selectedCount === rows.length
        const some = selectedCount > 0 && !all

        return (
          <div className='align-both'>
            <Checker
              top={1}
              checked={all}
              indeterminate={some}
               onChange={(v) => meta.toggleAll(v, ids)}
              aria-label='Select all'
            />
          </div>
        )
      },

      cell: ({ row, table }) => {
        const meta = table.options.meta as MultiSelectionTableMeta
        const id = getId(row as unknown as Row<TData>)
        const checked = meta.selected.has(id)

        return (
          <div className='align-both'>
            <Checker
              top={1}
              checked={checked}
               onChange={(v) => meta.toggleRow(id, v)}
              aria-label={`Select row ${id}`}
            />
          </div>
        )
      },
    }
  }, [])

  return {
    meta,
    selectColumn,
    selectedCount: selected.size,
    clear,
  }
}
