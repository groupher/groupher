import { pick } from 'ramda'
import { useContext } from 'react'
import { useSnapshot } from 'valtio'
import useViewingArticle from '~/hooks/useViewingArticle'
import type { TCommentsState } from '~/spec'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/provider'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'
import { API_MODE } from '../constant'
import type { TEditState, TFoldState, TRepliesState } from '../spec'

export type TRet = {
  getBasicState: () => TCommentsState
  getFoldState: () => TFoldState
  getEditState: () => TEditState
  getRepliesState: () => TRepliesState
}

export default function useDerived(): TRet {
  const commentsStore = useContext(CommentsStoreContext) as TCommentsStore | null
  if (!commentsStore) {
    throw new Error('useDerived must be used within a Comments store provider')
  }
  const commentsSnap = useSnapshot(commentsStore)
  const { article } = useViewingArticle()

  const getBasicState = (): TCommentsState => {
    let totalCount = 0

    if (commentsSnap.apiMode === API_MODE.ARTICLE) {
      totalCount = commentsSnap.totalCount === -1 ? article.commentsCount : commentsSnap.totalCount
    } else {
      // eslint-disable-next-line prefer-destructuring
      totalCount = commentsSnap.pagedPublishedComments.totalCount
    }

    return {
      isViewerJoined: commentsSnap.isViewerJoined,
      participantsCount: commentsSnap.participantsCount,
      totalCount,
      participants: [...commentsSnap.participants] as TCommentsState['participants'],
    }
  }

  const getFoldState = (): TFoldState => {
    const { foldedCommentIds } = commentsSnap
    const { pagedComments } = commentsSnap

    const isAllFolded =
      pagedComments.totalCount === 0 ? false : foldedCommentIds.length === pagedComments.totalCount

    return {
      foldedIds: [...foldedCommentIds] as string[],
      isAllFolded,
    }
  }

  const getEditState = (): TEditState => {
    const baseFields = pick(
      [
        'commentBody',
        'updateBody',
        'replyBody',
        'showEditor',
        'showReplyEditor',
        'showUpdateEditor',
        'submitState',
        'updateId',
      ],
      commentsSnap,
    )

    return {
      ...baseFields,
      submitState: {
        publishing: commentsSnap.publishing,
        publishDone: commentsSnap.publishDone,
        isReady: commentsSnap.wordsCountReady,
      },
      replyToComment: commentsSnap.replyToComment,
    }
  }

  const getRepliesState = (): TRepliesState => {
    return pick(['repliesParentId', 'repliesLoading'], commentsSnap)
  }

  return {
    getBasicState,
    getFoldState,
    getEditState,
    getRepliesState,
  }
}
