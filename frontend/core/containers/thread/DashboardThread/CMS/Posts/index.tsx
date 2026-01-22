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
        size: 520,
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

  // ✅ 关键：showSelectColumn=false 时，把 SELECT_COL_ID 当成 0 宽来算 offset，避免空白列
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

      {/* ✅ 用 data-select 作为 CSS 开关 */}
      <div
        data-select={showSelectColumn ? 'on' : 'off'}
        className='relative w-full overflow-x-auto overflow-y-visible bg-white border rounded-md'
      >
        <div className='min-w-full w-max'>
          <div className='border-b'>
            <div className='flex'>
              {table.getHeaderGroups().map((hg) =>
                hg.headers.map((header) => {
                  const col = header.column
                  const canSort = col.getCanSort()
                  const sortDir = col.getIsSorted() as TSortDir

                  const showSortIcon =
                    col.id === 'upvotesCount' || col.id === 'views' || col.id === 'commentsCount'

                  const p = sticky.header(col.id)
                  const isSelectCol = col.id === SELECT_COL_ID

                  return (
                    <button
                      key={header.id}
                      type='button'
                      className={cn(
                        'shrink-0 flex items-center gap-1 border-r px-2 py-2 text-xs font-semibold',
                        canSort ? 'cursor-pointer select-none hover:bg-black/5' : 'cursor-default',
                        // ✅ select 列标记（外层做 max-width 动画）
                        isSelectCol && 'table-col-select',
                        p.className,
                      )}
                      style={p.style}
                      onClick={canSort ? col.getToggleSortingHandler() : undefined}
                      aria-label={canSort ? 'Sort column' : undefined}
                    >
                      {/* ✅ select 列内容包一层（内层做 translate/opacity 动画） */}
                      {isSelectCol ? (
                        <div className='table-col-select-inner'>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      ) : (
                        <span className='truncate'>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}

                      {!isSelectCol && showSortIcon && (
                        <span className='ml-auto'>
                          {sortDir === 'asc' && <ArrowSVG className={s.icon.arrowUp} />}
                          {sortDir === 'desc' && <ArrowSVG className={s.icon.arrowDown} />}
                          {!sortDir && <FilterSVG className={s.icon.filter} />}
                        </span>
                      )}
                    </button>
                  )
                }),
              )}
            </div>
          </div>

          <div>
            {rows.map((row) => (
              <div key={row.id} className='border-b'>
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
                          // ✅ select 列标记（外层 max-width 动画）
                          isSelectCol && 'table-col-select',
                          p.className,
                        )}
                        style={p.style}
                      >
                        {/* ✅ select 列内容包一层（内层滑动/淡入淡出） */}
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
