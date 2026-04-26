'use client'

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { includes } from 'ramda'
import { startTransition, useMemo, useState } from 'react'

import {
  SELECT_COL_ID,
  type TSortDir,
  useMultiSelection,
  useScrollStuck,
  useStickyColumns,
} from '~/hooks/useTanTable'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/Arrow'
import FilterSVG from '~/icons/Filter'
import type { TCommunity } from '~/spec'
import TableLoading from '~/widgets/Loading/Table'

import useCMSInfo from '../../hooks/useCMSInfo'
import useSalon, { cn } from '../../salon/cms/communities'
import FilterBar from '../FilterBar'

const SORTABLE_COLUMN = ['subscribersCount', 'views', 'articlesCount']
const CLASSIC_ALIGN_LEFT = ['name', 'desc']
const CLASSIC_ALIGN_RIGHT = ['timestamps']

export default function Communities() {
  const { loading, pagedCommunities } = useCMSInfo()
  const s = useSalon({ loading: false })
  const { t } = useTrans()

  const [sorting, setSorting] = useState<SortingState>([])
  const [showSelectColumn, setShowSelectColumn] = useState(false)
  const { scrollRef, stuck } = useScrollStuck()

  // useMount(loadCommunities)

  const data = (pagedCommunities.entries ?? []) as TCommunity[]
  const { metaRef, selectColumn, selectedCount, clear } = useMultiSelection()

  const columns = useMemo<ColumnDef<TCommunity, unknown>[]>(() => {
    return [
      selectColumn(),

      {
        id: 'name',
        header: () => <div className={s.title}>{t('dsb.cms.communities.name')}</div>,
        cell: () => <div>TODO: CommunityCell</div>,
        size: 180,
        meta: { sticky: 'left' },
      },

      {
        accessorKey: 'desc',
        id: 'desc',
        header: () => <div className={s.title}>{t('dsb.cms.communities.desc')}</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'truncate')}>{String(getValue() ?? '')}</div>
        ),
        size: 200,
      },

      {
        id: 'state',
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.communities.state')}</div>
        ),
        cell: () => <div className='text-center'>TODO: PendingCell</div>,
        size: 90,
      },

      {
        accessorKey: 'subscribersCount',
        id: 'subscribersCount',
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.communities.followers')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        accessorKey: 'views',
        id: 'views',
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.communities.views')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        accessorKey: 'articlesCount',
        id: 'articlesCount',
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.communities.content')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        id: 'timestamps',
        header: () => (
          <div className={cn(s.title, 'text-right')}>{t('dsb.cms.communities.timestamps')}</div>
        ),
        cell: () => <div className='text-right'>TODO: TimestampCell</div>,
        size: 120,
      },
    ]
  }, [selectColumn, s.title, s.cell])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row, index) => row.id ?? `${row.slug}:${index ?? 0}`,
    meta: metaRef,
  })

  const sticky = useStickyColumns(table, { showSelectColumn })
  const rows = table.getRowModel().rows

  return (
    <>
      <FilterBar
        checkboxActive={showSelectColumn}
        triggerCheckbox={(next) => {
          startTransition(() => {
            setShowSelectColumn(next)
            clear()
          })
        }}
        selectedCount={selectedCount}
      />

      <div
        ref={scrollRef}
        data-select={showSelectColumn ? 'on' : 'off'}
        data-stuck-left={stuck.left ? 'on' : 'off'}
        data-stuck-right={stuck.right ? 'on' : 'off'}
        className={s.table.wrapper}
      >
        <div className={s.table.inner}>
          {/* header */}
          <div className={cn('flex border-b', s.table.border)}>
            {table.getHeaderGroups().map((hg) =>
              hg.headers.map((header) => {
                const col = header.column
                const canSort = col.getCanSort()
                const sortDir = col.getIsSorted() as TSortDir
                const showSortIcon = includes(col.id, SORTABLE_COLUMN)

                const p = sticky.header(col.id)
                const isSelectCol = col.id === SELECT_COL_ID

                return (
                  <button
                    key={header.id}
                    type='button'
                    className={cn(
                      s.table.actionBtn,
                      CLASSIC_ALIGN_LEFT.includes(col.id) && '!justify-start',
                      CLASSIC_ALIGN_RIGHT.includes(col.id) && '!justify-end',
                      canSort && s.table.canSort,
                      isSelectCol && 'table-col-select',
                      p.className,
                    )}
                    style={p.style}
                    onClick={canSort ? col.getToggleSortingHandler() : undefined}
                  >
                    {isSelectCol ? (
                      <div className='table-col-select-inner'>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    ) : (
                      <span className='truncate'>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    )}

                    {!isSelectCol && showSortIcon && (
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

          {/* body */}
          <div>
            {rows.map((row) => (
              <div key={row.id} className={cn('border-b', s.table.border)}>
                <div className='flex'>
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id
                    const p = sticky.cell(colId)
                    const isSelectCol = colId === SELECT_COL_ID

                    return (
                      <div
                        key={cell.id}
                        className={cn(s.table.cell, isSelectCol && 'table-col-select', p.className)}
                        style={p.style}
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
            ))}
          </div>
        </div>

        {loading && <TableLoading className='absolute top-10' />}
      </div>
    </>
  )
}
