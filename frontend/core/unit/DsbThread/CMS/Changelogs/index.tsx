'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import { getArticleRowId } from '~/hooks/useTanTable'
import useTrans from '~/hooks/useTrans'
import type { TArticleState } from '~/spec'

import { ArticleCell, AuthorCell, DateCell, StatusCell } from '../Cell'
import CmsDataTable from '../Table/CmsDataTable'
import CmsTableToolbar from '../Table/CmsTableToolbar'
import useCmsTableController from '../Table/useCmsTableController'
import useCmsArticles from '../useCmsArticles'
import useSalon, { cn } from './salon'

export default function Changelogs() {
  const { pagedArticles: pagedChangelogs, loading } = useCmsArticles('changelog')
  const s = useSalon({ loading })
  const { t } = useTrans()
  const table = useCmsTableController()

  const data = [...pagedChangelogs.entries]

  const columns = useMemo<ColumnDef<TArticleState, unknown>[]>(() => {
    return [
      {
        id: 'title',
        header: () => <div className={s.title}>{t('dsb.cms.table.title')}</div>,
        cell: ({ row }) => <ArticleCell rowData={row.original.content} />,
        size: 420,
        meta: { sticky: 'left', align: 'left' },
      },

      {
        id: 'status',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.status')}</div>,
        cell: ({ row }) => <StatusCell rowData={row.original.content} />,
        size: 120,
      },

      {
        accessorFn: (row) => row.stats?.upvotesCount ?? 0,
        id: 'upvotesCount',
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.upvotes')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        accessorFn: (row) => row.stats?.views ?? 0,
        id: 'views',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.views')}</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        accessorFn: (row) => row.stats?.commentsCount ?? 0,
        id: 'commentsCount',
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.comments')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue() ?? 0)}</div>
        ),
        size: 80,
        enableSorting: true,
      },

      {
        id: 'dates',
        header: () => <div className={cn(s.title, 'text-right')}>{t('dsb.cms.table.dates')}</div>,
        cell: ({ row }) => <DateCell rowData={row.original.content} />,
        size: 120,
        meta: { align: 'right' },
      },

      {
        id: 'author',
        header: () => <div className={cn(s.title, 'text-right')}>{t('dsb.cms.table.author')}</div>,
        cell: ({ row }) => <AuthorCell rowData={row.original.content} />,
        size: 160,
        meta: { sticky: 'right', align: 'right' },
      },
    ]
  }, [s.title, s.cell, t])

  return (
    <>
      <CmsTableToolbar
        multiSelectEnabled={table.multiSelectEnabled}
        onToggleMultiSelectAction={table.toggleMultiSelect}
        selectedCount={table.selectedCount}
        search={{
          value: table.searchValue,
          onChangeAction: table.setSearchValue,
          placeholder: t('dsb.cms.filter.search_placeholder'),
        }}
        withCategory
        withStatus
        withDateRange
        withReset
        onResetAction={table.resetFilters}
        batchActions={{
          onCancelAction: () => table.toggleMultiSelect(false),
          withDelete: true,
        }}
      />

      <CmsDataTable<TArticleState>
        data={data}
        columns={columns}
        loading={loading}
        sorting={table.sorting}
        onSortingChangeAction={table.setSorting}
        getRowIdAction={(item) => getArticleRowId(item.content)}
        multiSelect={{
          enabled: table.multiSelectEnabled,
          metaRef: table.metaRef,
          selectColumn: table.selectColumn,
        }}
      />
    </>
  )
}
