'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import useMount from '~/hooks/useMount'
import { getArticleRowId } from '~/hooks/useTanTable'
import useTrans from '~/hooks/useTrans'
import type { TArticle } from '~/spec'

import useCMSInfo from '../../hooks/useCMSInfo'
import { ArticleCell, AuthorCell, DateCell, StatusCell } from '../Cell'
import CmsDataTable from '../Table/CmsDataTable'
import CmsTableToolbar from '../Table/CmsTableToolbar'
import useCmsTableController from '../Table/useCmsTableController'
import useSalon, { cn } from './salon'

export default function Posts() {
  const { pagedPosts, loading, loadPosts } = useCMSInfo()
  const s = useSalon({ loading })
  const { t } = useTrans()
  const table = useCmsTableController()

  useMount(loadPosts)

  const data = (pagedPosts.entries ?? []) as TArticle[]

  const columns = useMemo<ColumnDef<TArticle, unknown>[]>(() => {
    return [
      {
        id: 'title',
        header: () => <div className={s.title}>{t('dsb.cms.posts.title')}</div>,
        cell: ({ row }) => <ArticleCell rowData={row.original} />,
        size: 350,
        meta: { sticky: 'left', align: 'left' },
      },
      {
        id: 'status',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.status')}</div>,
        cell: ({ row }) => <StatusCell rowData={row.original} />,
        size: 140,
      },
      {
        accessorKey: 'upvotesCount',
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
        cell: ({ row }) => <DateCell rowData={row.original} />,
        size: 120,
        meta: { align: 'right' },
      },
      {
        id: 'author',
        header: () => <div className={cn(s.title, 'text-right')}>{t('dsb.cms.table.author')}</div>,
        cell: ({ row }) => <AuthorCell rowData={row.original} />,
        size: 140,
        meta: { align: 'right' },
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

      <CmsDataTable<TArticle>
        data={data}
        columns={columns}
        loading={loading}
        sorting={table.sorting}
        onSortingChangeAction={table.setSorting}
        getRowIdAction={getArticleRowId}
        multiSelect={{
          enabled: table.multiSelectEnabled,
          metaRef: table.metaRef,
          selectColumn: table.selectColumn,
        }}
      />
    </>
  )
}
