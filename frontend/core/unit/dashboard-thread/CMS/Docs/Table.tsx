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
  getArticleRowId,
  SELECT_COL_ID,
  type TSortDir,
  useMultiSelection,
  useScrollStuck,
  useStickyColumns,
} from '~/hooks/useTanTable'
import ArrowSVG from '~/icons/Arrow'
import FilterSVG from '~/icons/Filter'
import useTrans from '~/hooks/useTrans'
import type { TPagedArticles } from '~/spec'
import TableLoading from '~/widgets/Loading/Table'
import useSalon, { cn } from '../../salon/cms/posts'
import { ArticleCell, DateCell, StateCell } from '../Cell'
import FilterBar from '../FilterBar'

const SORTABLE_COLUMN = ['upvotesCount', 'views', 'commentsCount']
const HEADER_ALIGN_LEFT = ['title']
const HEADER_ALIGN_RIGHT = ['dates', 'author']

type TProps = {
  pagedDocs: TPagedArticles
  loading: boolean
  batchSelectedIDs: string[]
}

export default function DocsTables({ pagedDocs, loading }: TProps) {
  const s = useSalon({ loading })
  const { t } = useTrans()

  const [sorting, setSorting] = useState<SortingState>([])
  const [showSelectColumn, setShowSelectColumn] = useState(false)
  const { scrollRef, stuck } = useScrollStuck()

  // 这个组件不负责请求数据；pagedDocs 由上层提供，所以不需要 loadPosts / useMount
  // useMount(...) 这里故意不调用

  const data = (pagedDocs.entries ?? []) as any[]
  const { metaRef, selectColumn, selectedCount, clear } = useMultiSelection()

  const columns = useMemo<ColumnDef<any, any>[]>(() => {
    return [
      // CheckCell 不存在：用你现有的 selectColumn()（内部应当已经包含 header 的全选）
      selectColumn(),

      {
        id: 'title',
        header: () => <div className={s.title}>{t('dsb.cms.table.title')}</div>,
        cell: ({ row }) => <ArticleCell rowData={row.original} />,
        size: 420,
        meta: { sticky: 'left' },
      },

      {
        id: 'state',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.state')}</div>,
        cell: ({ row }) => <StateCell rowData={row.original} />,
        size: 90,
      },

      {
        accessorKey: 'upvotesCount',
        id: 'upvotesCount',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.upvotes')}</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        accessorKey: 'views',
        id: 'views',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.views')}</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        accessorKey: 'commentsCount',
        id: 'commentsCount',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.comments')}</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        id: 'dates',
        header: () => <div className={cn(s.title, 'text-right')}>{t('dsb.cms.table.dates')}</div>,
        cell: ({ row }) => <DateCell rowData={row.original} />,
        size: 120,
      },

      {
        id: 'author',
        header: () => <div className={cn(s.title, 'text-right')}>{t('dsb.cms.table.author')}</div>,
        // AuthorDateCell 不存在：占位
        cell: () => <div className='text-right'>TODO: AuthorDateCell</div>,
        size: 140,
        meta: { sticky: 'right' },
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
    getRowId: (row, index) => getArticleRowId(row, index),
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
                      HEADER_ALIGN_LEFT.includes(col.id) && '!justify-start',
                      HEADER_ALIGN_RIGHT.includes(col.id) && '!justify-end',
                      canSort && s.table.canSort,
                      isSelectCol && 'table-col-select',
                      p.className,
                    )}
                    style={p.style}
                    onClick={canSort ? col.getToggleSortingHandler() : undefined}
                    aria-label={canSort ? t('dsb.cms.table.sort') : undefined}
                  >
                    {isSelectCol ? (
                      <div className='table-col-select-inner'>
                        {!header.isPlaceholder &&
                          flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    ) : (
                      <span className='truncate'>
                        {!header.isPlaceholder &&
                          flexRender(header.column.columnDef.header, header.getContext())}
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
