import { useContext } from 'react'
import { useSnapshot } from 'valtio'

import useViewingArticle from '~/hooks/useViewingArticle'
import type { TCommentsState } from '~/spec'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/provider'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'

import { API_MODE } from '../constant'
import type { TEditState } from '../spec'
import useActions, { type TActions } from './useActions'
import useDerived, { type TRet as TDrived } from './useDerived'

type TRet = TCommentsStore & TActions & TDrived

const useCommentsStore = () => {
  const commentsStore = useContext(CommentsStoreContext) as TCommentsStore | null
  if (!commentsStore) {
    throw new Error('useLogic must be used within a Comments store provider')
  }

  return commentsStore
}

export const useCommentsRootState = () => {
  const commentsStore = useCommentsStore()
  const comments = useSnapshot(commentsStore)

  return {
    initialized: comments.initialized,
    totalCount: comments.pagedComments.totalCount,
  }
}

export const useCommentsListState = () => {
  const commentsStore = useCommentsStore()
  const comments = useSnapshot(commentsStore)

  return {
    mode: comments.mode,
    apiMode: comments.apiMode,
    loading: comments.loading,
    pagedComments: comments.pagedComments as TCommentsStore['pagedComments'],
    foldedCommentIds: comments.foldedCommentIds as TCommentsStore['foldedCommentIds'],
    repliesLoadingByParentId:
      comments.repliesLoadingByParentId as TCommentsStore['repliesLoadingByParentId'],
  }
}

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
    updateId: comments.updateId,
    replyToComment: comments.replyToComment as TEditState['replyToComment'],
  }
}

export const useCommentsHeadState = () => {
  const commentsStore = useCommentsStore()
  const comments = useSnapshot(commentsStore)
  const { article } = useViewingArticle()

  const totalCount =
    comments.apiMode === API_MODE.ARTICLE
      ? comments.totalCount === -1
        ? article.commentsCount
        : comments.totalCount
      : comments.pagedPublishedComments.totalCount

  const basicState: TCommentsState = {
    isViewerJoined: comments.isViewerJoined,
    participantsCount: comments.participantsCount,
    totalCount,
    participants: comments.participants as TCommentsState['participants'],
  }

  return {
    mode: comments.mode,
    apiMode: comments.apiMode,
    loading: comments.loading,
    isAllFolded:
      comments.pagedComments.totalCount === 0
        ? false
        : comments.foldedCommentIds.length === comments.pagedComments.totalCount,
    basicState,
    commentBody: comments.commentBody,
    submitState: {
      publishing: comments.publishing,
      publishDone: comments.publishDone,
      isReady: comments.wordsCountReady,
    },
  }
}

export default function useLogic(): TRet {
  const commentsStore = useCommentsStore()
  const comments = useSnapshot(commentsStore)
  const actions = useActions()
  const derived = useDerived()

  return {
    ...comments,
    commit: commentsStore.commit,
    reset: commentsStore.reset,
    ...actions,
    ...derived,
    replyToComment: comments.replyToComment
      ? ({
          ...comments.replyToComment,
          replies: [...(comments.replyToComment.replies ?? [])],
        } as unknown as TEditState['replyToComment'])
      : null,
  } as unknown as TRet
}
