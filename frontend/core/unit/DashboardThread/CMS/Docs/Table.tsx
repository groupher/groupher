'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { getArticleRowId } from '~/hooks/useTanTable'
import useTrans from '~/hooks/useTrans'
import type { TArticle, TPagedArticles } from '~/spec'
import useSalon, { cn } from '../../salon/cms/posts'
import CmsDataTable from '../../Tables/CmsDataTable'
import CmsTableToolbar from '../../Tables/CmsTableToolbar'
import useCmsTableController from '../../Tables/useCmsTableController'
import { ArticleCell, DateCell, StateCell } from '../Cell'

type TProps = {
  pagedDocs: TPagedArticles
  loading: boolean
  batchSelectedIDs: string[]
}

export default function DocsTables({ pagedDocs, loading }: TProps) {
  const s = useSalon({ loading })
  const { t } = useTrans()
  const table = useCmsTableController()
  const data = (pagedDocs.entries ?? []) as TArticle[]

  const columns = useMemo<ColumnDef<TArticle, unknown>[]>(() => {
    return [
      {
        id: 'title',
        header: () => <div className={s.title}>{t('dsb.cms.table.title')}</div>,
        cell: ({ row }) => <ArticleCell rowData={row.original} />,
        size: 420,
        meta: { sticky: 'left', align: 'left' },
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
        cell: () => <div className='text-right'>TODO: AuthorDateCell</div>,
        size: 140,
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
        withState
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
