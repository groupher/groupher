'use client'

import type { SortingState } from '@tanstack/react-table'
import { useCallback, useState } from 'react'

import Pagi from '~/ui/Pagi'
import PaginationError from '~/ui/Pagi/PaginationError'

import CmsDataTable from '../Table/CmsDataTable'
import ConfirmPermanentDeleteModal from './ConfirmPermanentDeleteModal'
import EmptyState from './EmptyState'
import type { TRawPagedTrashedPosts } from './spec'
import type { TTrashedPost } from './spec'
import TrashToolbar from './TrashToolbar'
import useColumns from './useColumns'
import useTrashedPosts from './useTrashedPosts'

const getTrashRowId = (item: TTrashedPost): string => item.id

type TOrdinaryThread = 'POST' | 'BLOG' | 'CHANGELOG'

export default function PostTrash({
  initialData,
  thread = 'POST',
}: {
  initialData?: TRawPagedTrashedPosts | null
  thread?: TOrdinaryThread
}) {
  const { activeActionId, loading, error, retry, pagedPosts, permanentlyDelete, restore, setPage } =
    useTrashedPosts(initialData, thread)
  const [sorting, setSorting] = useState<SortingState>([])
  const [deleteCandidate, setDeleteCandidate] = useState<TTrashedPost | null>(null)
  const requestPermanentDelete = useCallback((item: TTrashedPost) => {
    setDeleteCandidate(item)
  }, [])
  const closePermanentDelete = useCallback(() => {
    if (activeActionId === null) setDeleteCandidate(null)
  }, [activeActionId])
  const columns = useColumns({
    activeActionId,
    onRestore: restore,
    onRequestPermanentDelete: requestPermanentDelete,
  })

  const info = pagedPosts.pageInfo
  const totalCount =
    info.__typename === 'OffsetPageInfo' ? info.totalCount : pagedPosts.entries.length

  return (
    <>
      <TrashToolbar totalCount={totalCount} />
      <CmsDataTable<TTrashedPost>
        data={pagedPosts.entries}
        columns={columns}
        loading={loading}
        sorting={sorting}
        onSortingChangeAction={setSorting}
        getRowIdAction={getTrashRowId}
        emptyState={<EmptyState />}
      />
      {error && <PaginationError isRetrying={loading} onRetry={() => void retry()} />}
      <Pagi pageInfo={info} onChange={setPage} top={6} />
      <ConfirmPermanentDeleteModal
        item={deleteCandidate}
        loading={activeActionId === deleteCandidate?.id}
        onClose={closePermanentDelete}
        onConfirm={permanentlyDelete}
      />
    </>
  )
}
