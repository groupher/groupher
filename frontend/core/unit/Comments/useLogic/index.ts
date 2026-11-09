import { useContext } from 'react'
import { useSnapshot } from 'valtio'

import useViewingArticle from '~/hooks/useViewingArticle'
import type { TCommentsState } from '~/spec'
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
  const { data, feed, summaryQuery } = useCommentQueryState()

  return {
    initialized: !feed.pending,
    totalCount: summaryQuery.data?.totalCount ?? data?.entries.length ?? 0,
  }
}

/** Exposes comments list state state and actions through the shared React hook boundary. */
export const useCommentsListState = () => {
  const { comments, data, feed } = useCommentQueryState()
  return {
    mode: comments.mode,
    apiMode: comments.apiMode,
    loading: feed.pending,
    entries: [...(data?.pinnedEntries || []), ...(data?.entries || [])],
    foldedCommentIds: [
      ...comments.foldedCommentIds,
      ...[...(data?.pinnedEntries || []), ...(data?.entries || [])]
        .filter(
          (comment) => comment.isFolded && !comments.expandedCommentIds.includes(comment.innerId),
        )
        .map((comment) => comment.innerId),
    ],
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
  const { stats } = useViewingArticle()
  const { data, feed, summaryQuery } = useCommentQueryState()
  const totalCount = summaryQuery.data?.totalCount ?? stats?.commentsCount ?? 0

  const basicState: TCommentsState = {
    participantsCount: summaryQuery.data?.participantsCount ?? 0,
    totalCount,
    participants: summaryQuery.data?.participants || [],
  }

  return {
    mode: comments.mode,
    apiMode: comments.apiMode,
    loading: feed.fetching,
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
