import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { useSnapshot } from 'valtio'

import useViewingArticle from '~/hooks/useViewingArticle'
import { mergeCommentViewerState } from '~/lib/commentViewerState'
import { Q } from '~/query'
import type { TComment, TPagedComments } from '~/spec'
import useAccount from '~/stores/account/hooks'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/context'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'

/** Combines public comments with viewer-owned flags without duplicating either cache. */
export default function useCommentQueryState() {
  const commentsStore = useContext(CommentsStoreContext) as TCommentsStore | null
  if (!commentsStore)
    throw new Error('comments query must be used within a Comments store provider')
  const comments = useSnapshot(commentsStore)
  const account = useAccount()
  const { article } = useViewingArticle()
  const query = useQuery(
    Q.comment.list(
      article.community.slug,
      article.meta.thread,
      article.innerId,
      comments.page,
      comments.mode,
    ),
  )
  const viewerQuery = useQuery(
    Q.viewer.commentStates(
      account.user?.login || '',
      article.community.slug,
      article.meta.thread,
      article.innerId,
      comments.page,
      comments.mode,
    ),
  )
  const summaryQuery = useQuery(
    Q.viewer.commentSummary(
      account.user?.login || '',
      article.community.slug,
      article.meta.thread,
      article.innerId,
    ),
  )
  const data = useMemo(() => {
    if (!query.data || !viewerQuery.data) return query.data
    return {
      ...query.data,
      entries: (query.data.entries as unknown as TComment[]).map((comment) =>
        mergeCommentViewerState(comment, viewerQuery.data),
      ),
    } as TPagedComments
  }, [query.data, viewerQuery.data])

  return { comments, commentsStore, data, query, summaryQuery }
}
