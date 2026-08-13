import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import useTrans from '~/hooks/useTrans'

import { StatusCell } from '../Cell'
import ActionsCell from './ActionsCell'
import DeletedByCell from './DeletedByCell'
import useSalon, { cn } from './salon'
import type { TTrashedPost } from './spec'
import TitleCell from './TitleCell'
import TrashDatesCell from './TrashDatesCell'

type TOptions = {
  activeActionId: string | null
  onRestore: (id: string) => Promise<boolean>
  onRequestPermanentDelete: (item: TTrashedPost) => void
}

/** Exposes columns state and actions through the shared React hook boundary. */
export default function useColumns({
  activeActionId,
  onRestore,
  onRequestPermanentDelete,
}: TOptions): ColumnDef<TTrashedPost, unknown>[] {
  const s = useSalon()
  const { t } = useTrans()

  return useMemo(
    () => [
      {
        id: 'title',
        header: () => <div className={s.title}>{t('dsb.cms.trash.title')}</div>,
        cell: ({ row }) => <TitleCell item={row.original} />,
        size: 340,
        meta: { sticky: 'left', align: 'left' },
      },
      {
        id: 'status',
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.status')}</div>,
        cell: ({ row }) =>
          row.original.article ? <StatusCell rowData={row.original.article} /> : null,
        size: 130,
      },
      {
        id: 'upvotesCount',
        accessorFn: (item) => item.article?.upvotesCount ?? 0,
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.upvotes')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue())}</div>
        ),
        size: 80,
      },
      {
        id: 'views',
        accessorFn: (item) => item.article?.views ?? 0,
        header: () => <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.views')}</div>,
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue())}</div>
        ),
        size: 80,
      },
      {
        id: 'commentsCount',
        accessorFn: (item) => item.article?.commentsCount ?? 0,
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.table.comments')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue())}</div>
        ),
        size: 80,
      },
      {
        id: 'mentionedByCount',
        accessorFn: (item) => item.mentionedByCount,
        header: () => (
          <div className={cn(s.title, 'text-center')}>{t('dsb.cms.trash.mentioned_by')}</div>
        ),
        cell: ({ getValue }) => (
          <div className={cn(s.cell, 'text-center')}>{Number(getValue())}</div>
        ),
        size: 90,
      },
      {
        id: 'deletedBy',
        header: () => (
          <div className={cn(s.title, 'text-right')}>{t('dsb.cms.trash.deleted_by')}</div>
        ),
        cell: ({ row }) => <DeletedByCell item={row.original} />,
        size: 130,
        meta: { align: 'right' },
      },
      {
        id: 'trashDates',
        header: () => <div className={cn(s.title, 'text-right')}>{t('dsb.cms.trash.dates')}</div>,
        cell: ({ row }) => <TrashDatesCell item={row.original} />,
        size: 190,
        meta: { align: 'right' },
      },
      {
        id: 'actions',
        header: () => <div className={cn(s.title, 'text-right')}>{t('dsb.cms.trash.actions')}</div>,
        cell: ({ row }) => (
          <ActionsCell
            item={row.original}
            activeActionId={activeActionId}
            onRestore={onRestore}
            onRequestPermanentDelete={onRequestPermanentDelete}
          />
        ),
        size: 220,
        meta: { sticky: 'right', align: 'right' },
      },
    ],
    [activeActionId, onRequestPermanentDelete, onRestore, s.cell, s.title, t],
  )
}
