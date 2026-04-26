'use client'

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'

import { SELECT_COL_ID, useScrollStuck, useStickyColumns } from '~/hooks/useTanTable'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/Arrow'
import FilterSVG from '~/icons/Filter'
import TableLoading from '~/widgets/Loading/Table'

import useSalon, { cn, cnMerge } from '../salon/cms'
import type { TCmsDataTableProps } from './types'

const ROW_SELECT_IGNORE_SELECTOR =
  'button, a, input, label, textarea, select, [data-row-select-ignore]'

const alignClassName = (align?: 'left' | 'center' | 'right') => {
  if (align === 'left') return '!justify-start'
  if (align === 'right') return '!justify-end'
  return ''
}

export default function CmsDataTable<TData>({
  columns,
  data,
  emptyState = null,
  getRowIdAction,
  loading = false,
  multiSelect = null,
  onSortingChangeAction,
  sorting,
}: TCmsDataTableProps<TData>) {
  const s = useSalon({ loading })
  const { t } = useTrans()
  const { scrollRef, stuck } = useScrollStuck()

  const columnsWithSelection = useMemo(
    () => (multiSelect ? [multiSelect.selectColumn<TData>(), ...columns] : columns),
    [columns, multiSelect],
  )

  const table = useReactTable<TData>({
    data,
    columns: columnsWithSelection,
    state: { sorting },
    onSortingChange: onSortingChangeAction,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowIdAction,
    meta: multiSelect?.metaRef,
  })

  const rows = table.getRowModel().rows
  const sticky = useStickyColumns(table, { showSelectColumn: multiSelect?.enabled })

  return (
    <div
      ref={scrollRef}
      data-select={multiSelect?.enabled ? 'on' : 'off'}
      data-stuck-left={stuck.left ? 'on' : 'off'}
      data-stuck-right={stuck.right ? 'on' : 'off'}
      className={s.table.wrapper}
    >
      <div className={s.table.inner}>
        <div className={cn('flex border-b', s.table.border)}>
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => {
              const column = header.column
              const canSort = column.getCanSort()
              const sortDir = column.getIsSorted()
              const stickyProps = sticky.header(column.id)
              const isSelectCol = column.id === SELECT_COL_ID
              const align = column.columnDef.meta?.align

              return (
                <button
                  key={header.id}
                  type='button'
                  className={cn(
                    s.table.actionBtn,
                    alignClassName(align),
                    canSort && s.table.canSort,
                    isSelectCol && 'table-col-select',
                    stickyProps.className,
                  )}
                  style={stickyProps.style}
                  onClick={canSort ? column.getToggleSortingHandler() : undefined}
                  aria-label={canSort ? t('dsb.cms.table.sort') : undefined}
                >
                  {isSelectCol ? (
                    <div className='table-col-select-inner'>
                      {!header.isPlaceholder &&
                        flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                  ) : (
                    <span className='min-w-0 flex-1 truncate'>
                      {!header.isPlaceholder &&
                        flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                  )}

                  {!isSelectCol && canSort && (
                    <>
                      {sortDir === 'asc' && <ArrowSVG className={s.icon.arrowUp} />}
                      {sortDir === 'desc' && <ArrowSVG className={s.icon.arrowDown} />}
                      {!sortDir && <FilterSVG className={s.icon.filter} />}
                    </>
                  )}
                </button>
              )
            }),
          )}
        </div>

        <div>
          {rows.map((row) => {
            const isSelected = multiSelect?.metaRef.current.selected.has(row.id) ?? false
            const handleRowToggle = () => {
              if (!multiSelect?.enabled) return

              const checked = multiSelect.metaRef.current.selected.has(row.id)
              multiSelect.metaRef.current.toggleRow(row.id, !checked)
            }

            return (
              <div key={row.id} className={cn('border-b', s.table.border)}>
                <div
                  className={cn(
                    'flex',
                    multiSelect?.enabled && 'table-row-hoverable cursor-pointer',
                    multiSelect?.enabled && s.table.multiSelectRow,
                  )}
                  role='button'
                  tabIndex={multiSelect?.enabled ? 0 : -1}
                  onClick={
                    multiSelect?.enabled
                      ? (event) => {
                          const target = event.target
                          if (!(target instanceof HTMLElement)) return
                          if (target.closest(ROW_SELECT_IGNORE_SELECTOR)) return

                          handleRowToggle()
                        }
                      : undefined
                  }
                  onKeyDown={
                    multiSelect?.enabled
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          const target = event.target
                          if (!(target instanceof HTMLElement)) return
                          if (target.closest(ROW_SELECT_IGNORE_SELECTOR)) return

                          event.preventDefault()
                          handleRowToggle()
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const stickyProps = sticky.cell(cell.column.id)
                    const isSelectCol = cell.column.id === SELECT_COL_ID

                    return (
                      <div
                        key={cell.id}
                        className={cnMerge(
                          'table-row-cell',
                          s.table.cell,
                          isSelectCol && 'table-col-select',
                          stickyProps.className,
                          isSelected && s.table.stickyActiveBg,
                        )}
                        style={stickyProps.style}
                      >
                        {isSelectCol ? (
                          <div className='table-col-select-inner'>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {!loading && rows.length === 0 && emptyState}
        </div>
      </div>

      {loading && <TableLoading className='absolute top-10' />}
    </div>
  )
}
