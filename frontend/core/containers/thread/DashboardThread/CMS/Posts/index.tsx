'use client'

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useRef, useState } from 'react'
import useMount from '~/hooks/useMount'
import useTableSelection from '~/hooks/useTableSelection'
import ArrowSVG from '~/icons/Arrow'
import FilterSVG from '~/icons/Filter'
import type { TArticle } from '~/spec'
import Checker from '~/widgets/Checker'
import useCMSInfo from '../../hooks/useCMSInfo'
import useSalon, { cn } from '../../salon/cms/posts'
import { ArticleCell, AuthorCell, DateCell, StateCell } from '../Cell'
import FilterBar from '../FilterBar'

const CHECK_COL_WIDTH = 44
type SortDir = 'asc' | 'desc' | false

type TableMeta = {
  showCheckColumn: boolean
  selected: Set<string>
  toggleRow: (id: string, checked: boolean) => void
  toggleAll: (checked: boolean, ids: string[]) => void
  isAllSelected: (ids: string[]) => boolean
  isSomeSelected: (ids: string[]) => boolean
}

export default function Posts() {
  const s = useSalon()

  const { pagedPosts, loading, loadPosts } = useCMSInfo()

  const [sorting, setSorting] = useState<SortingState>([])
  const [showCheckColumn, setShowCheckColumn] = useState(false)

  useMount(loadPosts)

  const data = (pagedPosts.entries ?? []) as TArticle[]

  const { selected, selectedCount, toggleRow, toggleAll, isAllSelected, isSomeSelected } =
    useTableSelection()

  const metaRef = useRef<TableMeta>({
    showCheckColumn: false,
    selected: new Set(),
    toggleRow: () => {},
    toggleAll: () => {},
    isAllSelected: () => false,
    isSomeSelected: () => false,
  })

  metaRef.current.showCheckColumn = showCheckColumn
  metaRef.current.selected = selected
  metaRef.current.toggleRow = toggleRow
  metaRef.current.toggleAll = toggleAll
  metaRef.current.isAllSelected = isAllSelected
  metaRef.current.isSomeSelected = isSomeSelected

  const columns = useMemo<ColumnDef<TArticle, any>[]>(() => {
    return [
      {
        id: 'select',
        size: CHECK_COL_WIDTH,
        enableSorting: false,
        header: ({ table }) => {
          const meta = table.options.meta as React.RefObject<TableMeta>
          if (!meta.current?.showCheckColumn) return null

          const rows = table.getRowModel().rows
          const modelIds = rows
            .map((r) => r.original?.innerId)
            .filter((v): v is string => typeof v === 'string' && v.length > 0)

          const allChecked = meta.current.isAllSelected(modelIds)
          const someChecked = meta.current.isSomeSelected(modelIds)

          return (
            <div className='flex items-center justify-center'>
              <Checker
                checked={allChecked}
                indeterminate={someChecked}
                top={1}
                left={1.5}
                onChange={(nextChecked) => meta.current?.toggleAll(nextChecked, modelIds)}
                aria-label='Select all'
              />
            </div>
          )
        },
        cell: ({ row, table }) => {
          const meta = table.options.meta as React.RefObject<TableMeta>
          if (!meta.current?.showCheckColumn) return null

          const id = row.original?.innerId ?? ''
          const checked = id ? meta.current.selected.has(id) : false

          return (
            <div className='flex items-center justify-center'>
              <Checker
                checked={checked}
                top={1}
                onChange={(nextChecked) => {
                  if (!id) return
                  meta.current?.toggleRow(id, nextChecked)
                }}
                aria-label={`Select row ${id}`}
              />
            </div>
          )
        },
      },
      {
        id: 'title',
        header: () => <div className={s.title}>帖子标题</div>,
        cell: ({ row }) => <ArticleCell rowData={row.original} />,
        size: 520,
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
          <div className={cn(s.cell, 'text-center tabular-nums')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },
      {
        accessorKey: 'views',
        id: 'views',
        header: () => <div className={cn(s.title, 'text-center')}>浏览</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center tabular-nums')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },
      {
        accessorKey: 'commentsCount',
        id: 'commentsCount',
        header: () => <div className={cn(s.title, 'text-center')}>评论</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center tabular-nums')}>{Number(getValue() ?? 0)}</div>
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
      },
    ]
  }, [s.title, s.cell])

  const table = useReactTable<TArticle>({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.innerId,
    meta: metaRef,
  })

  const rows = table.getRowModel().rows

  // checkbox 列：showCheckColumn 才占宽
  const getColWidth = (colId: string, size: number) => {
    if (colId !== 'select') return size
    return showCheckColumn ? CHECK_COL_WIDTH : 0
  }

  // —— 固定列：第1列(select)、第2列(title)、最后1列(author) ——
  const getPinned = (colId: string) => {
    if (colId === 'select') return 'left' as const
    if (colId === 'title') return 'left' as const
    if (colId === 'author') return 'right' as const
    return false as const
  }

  const getStickyStyle = (colId: string, width: number) => {
    const pin = getPinned(colId)
    if (!pin) return undefined

    // 左侧：select=0；title=selectWidth
    if (pin === 'left') {
      const left = colId === 'title' ? getColWidth('select', CHECK_COL_WIDTH) : 0
      return { position: 'sticky' as const, left, width }
    }

    // 右侧：author=0
    return { position: 'sticky' as const, right: 0, width }
  }

  const getStickyClass = (colId: string) => {
    const pin = getPinned(colId)
    if (!pin) return ''
    // header 比 body 更高层级（避免被遮住）
    // 这里返回基础，header/body 里再叠加各自 z-index
    return 'bg-white'
  }

  return (
    <>
      <FilterBar
        checkboxActive={showCheckColumn}
        triggerCheckbox={setShowCheckColumn}
        selectedCount={selectedCount}
      />

      <div className='relative w-full overflow-x-auto overflow-y-visible bg-white border rounded-md'>
        <div className='min-w-full w-max'>
          <div className='border-b'>
            <div className='flex'>
              {table.getHeaderGroups().map((hg) =>
                hg.headers.map((header) => {
                  const col = header.column
                  const canSort = col.getCanSort()
                  const sortDir = col.getIsSorted() as SortDir

                  const width = getColWidth(col.id, col.getSize())
                  const isHiddenSelect = col.id === 'select' && !showCheckColumn

                  const showSortIcon =
                    col.id === 'upvotesCount' || col.id === 'views' || col.id === 'commentsCount'

                  const pinned = getPinned(col.id)
                  const stickyStyle = getStickyStyle(col.id, width)

                  return (
                    <button
                      key={header.id}
                      type='button'
                      className={cn(
                        'shrink-0 flex items-center gap-1 border-r px-2 py-2 text-xs font-semibold',
                        canSort ? 'cursor-pointer select-none hover:bg-black/5' : 'cursor-default',
                        isHiddenSelect && 'border-none px-0',
                        pinned && getStickyClass(col.id),
                        pinned && 'z-30', // header 最高
                        // 视觉分割：左固定列右侧加阴影，右固定列左侧加阴影
                        pinned === 'left' && 'shadow-[2px_0_0_0_rgba(0,0,0,0.06)]',
                        pinned === 'right' && 'shadow-[-2px_0_0_0_rgba(0,0,0,0.06)]',
                      )}
                      style={{
                        width,
                        overflow: 'hidden',
                        ...(stickyStyle ?? {}),
                      }}
                      onClick={canSort ? col.getToggleSortingHandler() : undefined}
                      aria-label={canSort ? 'Sort column' : undefined}
                    >
                      <span className='truncate'>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </span>

                      {showSortIcon && (
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

          {/* Body（非虚拟，分页 20 条） */}
          <div>
            {rows.map((row) => (
              <div key={row.id} className='border-b'>
                <div className='flex'>
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id
                    const width = getColWidth(colId, cell.column.getSize())
                    const isHiddenSelect = colId === 'select' && !showCheckColumn

                    const pinned = getPinned(colId)
                    const stickyStyle = getStickyStyle(colId, width)

                    return (
                      <div
                        key={cell.id}
                        className={cn(
                          'shrink-0 px-2 py-2 text-sm border-r',
                          isHiddenSelect && 'border-none px-0',
                          pinned && getStickyClass(colId),
                          pinned && 'z-20', // body 固定列在普通列之上
                          pinned === 'left' && 'shadow-[2px_0_0_0_rgba(0,0,0,0.06)]',
                          pinned === 'right' && 'shadow-[-2px_0_0_0_rgba(0,0,0,0.06)]',
                        )}
                        style={{
                          width,
                          overflow: 'hidden',
                          ...(stickyStyle ?? {}),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
