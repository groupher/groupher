// Posts.tsx
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
import useMount from '~/hooks/useMount'
import {
  getArticleRowId,
  SELECT_COL_ID,
  type TSortDir,
  useMultiSelection,
  useStickyColumns,
} from '~/hooks/useTanTable'
import ArrowSVG from '~/icons/Arrow'
import FilterSVG from '~/icons/Filter'
import type { TArticle } from '~/spec'
import useCMSInfo from '../../hooks/useCMSInfo'
import useSalon, { cn } from '../../salon/cms/posts'
import { ArticleCell, AuthorCell, DateCell, StateCell } from '../Cell'
import FilterBar from '../FilterBar'

const SORTABLE_COLUMN = ['upvotesCount', 'views', 'commentsCount']
const HEADER_ALIGN_LEFT = ['title']
const HEADER_ALIGN_RIGHT = ['dates', 'author']

export default function Posts() {
  const s = useSalon()
  const { pagedPosts, loading, loadPosts } = useCMSInfo()

  const [sorting, setSorting] = useState<SortingState>([])
  const [showSelectColumn, setShowSelectColumn] = useState(false)

  useMount(loadPosts)

  const data = (pagedPosts.entries ?? []) as TArticle[]
  const { metaRef, selectColumn, selectedCount, clear } = useMultiSelection()

  const columns = useMemo<ColumnDef<TArticle, any>[]>(() => {
    return [
      selectColumn(),

      {
        id: 'title',
        header: () => <div className={s.title}>帖子标题</div>,
        cell: ({ row }) => <ArticleCell rowData={row.original} />,
        size: 420,
        meta: { sticky: 'left' },
      },
      {
        id: 'state',
        header: () => <div className={cn(s.title, 'text-center')}>状态</div>,
        cell: ({ row }) => <StateCell rowData={row.original} />,
        size: 120,
      },
      {
        accessorKey: 'upvotesCount',
        id: 'upvotesCount',
        header: () => <div className={cn(s.title, 'text-center')}>投票</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },
      {
        accessorKey: 'views',
        id: 'views',
        header: () => <div className={cn(s.title, 'text-center')}>浏览</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },
      {
        accessorKey: 'commentsCount',
        id: 'commentsCount',
        header: () => <div className={cn(s.title, 'text-center')}>评论</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },
      {
        id: 'dates',
        header: () => <div className={cn(s.title, 'text-right')}>发布/活跃</div>,
        cell: ({ row }) => <DateCell rowData={row.original} />,
        size: 120,
      },
      {
        id: 'author',
        header: () => <div className={cn(s.title, 'text-right')}>作者</div>,
        cell: ({ row }) => <AuthorCell rowData={row.original} />,
        size: 140,
        meta: { sticky: 'right' },
      },
    ]
  }, [selectColumn, s.title, s.cell])

  const table = useReactTable<TArticle>({
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

      <div data-select={showSelectColumn ? 'on' : 'off'} className={s.table.wrapper}>
        <div className={s.table.inner}>
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
                    aria-label={canSort ? 'Sort column' : undefined}
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
                        className={cn(
                          'shrink-0 px-2 py-2 text-sm border-r',
                          s.table.border,
                          isSelectCol && 'table-col-select',
                          p.className,
                        )}
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

        {loading && <div className='absolute inset-0 pointer-events-none bg-white/40' />}
      </div>
    </>
  )
}
