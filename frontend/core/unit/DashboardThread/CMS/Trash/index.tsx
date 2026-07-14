'use client'

import type { SortingState } from '@tanstack/react-table'
import { useCallback, useState } from 'react'

import Pagi from '~/widgets/Pagi'

import CmsDataTable from '../Table/CmsDataTable'
import ConfirmPermanentDeleteModal from './ConfirmPermanentDeleteModal'
import EmptyState from './EmptyState'
import type { TTrashedPost } from './spec'
import TrashToolbar from './TrashToolbar'
import useColumns from './useColumns'
import useTrashedPosts from './useTrashedPosts'

const getTrashRowId = (item: TTrashedPost): string => item.id

export default function PostTrash() {
  const { activeActionId, loading, pagedPosts, permanentlyDelete, restore, setPage } =
    useTrashedPosts()
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

  const pageNumber = pagedPosts.pageNumber ?? 1
  const pageSize = pagedPosts.pageSize ?? 20
  const totalCount = pagedPosts.totalCount ?? 0
  const totalPages = pagedPosts.totalPages ?? 0

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
      <Pagi
        pageNumber={pageNumber}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        onChange={setPage}
        top={6}
      />
      <ConfirmPermanentDeleteModal
        item={deleteCandidate}
        loading={activeActionId === deleteCandidate?.id}
        onClose={closePermanentDelete}
        onConfirm={permanentlyDelete}
      />
    </>
  )
}
