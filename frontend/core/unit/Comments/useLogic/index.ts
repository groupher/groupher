import { useContext } from 'react'
import { useSnapshot } from 'valtio'

import useViewingArticle from '~/hooks/useViewingArticle'
import type { TCommentsState, TPagedComments } from '~/spec'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/context'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'

import type { TEditState } from '../spec'
import { areAllCommentsFolded } from './fold'
import useCommentQueryState from './queryState'

const useCommentsStore = () => {
  const commentsStore = useContext(CommentsStoreContext) as TCommentsStore | null
  if (!commentsStore) {
    throw new Error('useLogic must be used within a Comments store provider')
  }

  return commentsStore
}

/** Exposes comments root state state and actions through the shared React hook boundary. */
export const useCommentsRootState = () => {
  const { data, query } = useCommentQueryState()

  return {
    initialized: !query.isPending,
    totalCount: data?.totalCount || 0,
  }
}

/** Exposes comments list state state and actions through the shared React hook boundary. */
export const useCommentsListState = () => {
  const { comments, data, query } = useCommentQueryState()

  return {
    mode: comments.mode,
    apiMode: comments.apiMode,
    loading: query.isFetching,
    pagedComments: (data || {
      entries: [],
      totalCount: 0,
    }) as TPagedComments,
    foldedCommentIds: comments.foldedCommentIds as TCommentsStore['foldedCommentIds'],
    repliesLoadingByParentId:
      comments.repliesLoadingByParentId as TCommentsStore['repliesLoadingByParentId'],
  }
}

/** Exposes comments edit state state and actions through the shared React hook boundary. */
export const useCommentsEditState = (): TEditState => {
  const commentsStore = useCommentsStore()
  const comments = useSnapshot(commentsStore)

  return {
    commentBody: comments.commentBody,
    updateBody: comments.updateBody,
    replyBody: comments.replyBody,
    showEditor: comments.showEditor,
    showReplyEditor: comments.showReplyEditor,
    showUpdateEditor: comments.showUpdateEditor,
    submitState: {
      publishing: comments.publishing,
      publishDone: comments.publishDone,
      isReady: comments.wordsCountReady,
    },
    updateInnerId: comments.updateInnerId,
    replyToComment: comments.replyToComment as TEditState['replyToComment'],
  }
}

/** Exposes comments head state state and actions through the shared React hook boundary. */
export const useCommentsHeadState = () => {
  const commentsStore = useCommentsStore()
  const comments = useSnapshot(commentsStore)
  const { article } = useViewingArticle()
  const { data, query, summaryQuery } = useCommentQueryState()
  const totalCount = summaryQuery.data?.totalCount ?? data?.totalCount ?? article.commentsCount

  const basicState: TCommentsState = {
    isViewerJoined: summaryQuery.data?.isViewerJoined ?? false,
    participantsCount: summaryQuery.data?.participantsCount ?? 0,
    totalCount,
    participants: summaryQuery.data?.participants || [],
  }

  return {
    mode: comments.mode,
    apiMode: comments.apiMode,
    loading: query.isFetching,
    isAllFolded: areAllCommentsFolded(data?.entries || [], comments.foldedCommentIds),
    basicState,
    commentBody: comments.commentBody,
    submitState: {
      publishing: comments.publishing,
      publishDone: comments.publishDone,
      isReady: comments.wordsCountReady,
    },
  }
}
