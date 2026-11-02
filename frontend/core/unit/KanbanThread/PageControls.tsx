import type { TKanbanPage } from '~/hooks/useKanbanTickets'
import Pagi from '~/ui/Pagi'
import CursorPagination from '~/ui/Pagi/CursorPagination'

/** Each board owns its continuation and retry independently of adjacent boards. */
export default function PageControls({ page }: { page: TKanbanPage }) {
  if (page.error)
    return (
      <button type='button' onClick={page.retry}>
        重试
      </button>
    )
  if (page.pageInfo?.__typename === 'OffsetPageInfo' && page.mode === 'page')
    return <Pagi pageInfo={page.pageInfo} onChange={page.setPage} />
  return (
    <CursorPagination
      mode={page.mode}
      hasNextPage={!!page.pageInfo?.hasNextPage}
      isLoading={page.pending}
      onLoadMore={page.next}
      onRetry={page.retry}
      error={null}
    />
  )
}
