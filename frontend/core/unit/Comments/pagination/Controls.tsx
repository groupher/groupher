import { ANCHOR } from '~/const/dom'
import { scrollIntoEle } from '~/dom'
import Pagi from '~/ui/Pagi'
import CursorPagination from '~/ui/Pagi/CursorPagination'

import { useCommentFeed } from './context'

/** Shared finite/cursor controls for main comments and independently expanded reply lists. */
export default function Controls() {
  const feed = useCommentFeed()
  if (feed.error)
    return (
      <div role='alert'>
        评论加载失败{' '}
        <button type='button' onClick={feed.retry}>
          重试
        </button>
      </div>
    )
  if (feed.pending) return <p role='status'>加载中...</p>
  const info = feed.data?.pageInfo
  if (!info) return null
  if (info.api === 'offset')
    return (
      <Pagi
        pageInfo={info}
        onChange={(page) => {
          feed.setPage(page)
          if (!feed.collection.rootInnerId) scrollIntoEle(ANCHOR.COMMENTS_ID)
        }}
        showBottomMsg
        noMoreMsg='没有更多评论'
        emptyMsg='暂无评论'
      />
    )
  return (
    <CursorPagination
      mode={feed.collection.rootInnerId ? 'LOAD_MORE' : feed.config.mode}
      hasNextPage={feed.hasNext}
      isLoading={feed.loadingNext}
      error={feed.nextError}
      onLoadMore={feed.loadNext}
      onRetry={feed.loadNext}
    />
  )
}
