import { pick } from 'ramda'
import { useSnapshot } from 'valtio'
import useViewingArticle from '~/hooks/useViewingArticle'
import type { TCommentsState } from '~/spec'
import { API_MODE } from '../constant'
import type { TEditState, TFoldState, TRepliesState } from '../spec'

import store from './store'

export type TRet = {
  getBasicState: () => TCommentsState
  getFoldState: () => TFoldState
  getEditState: () => TEditState
  getRepliesState: () => TRepliesState
}

export default (): TRet => {
  const snap = useSnapshot(store)
  const { article } = useViewingArticle()

  const getBasicState = (): TCommentsState => {
    let totalCount = 0

    if (snap.apiMode === API_MODE.ARTICLE) {
      totalCount = snap.totalCount === -1 ? article.commentsCount : snap.totalCount
    } else {
      // eslint-disable-next-line prefer-destructuring
      totalCount = snap.pagedPublishedComments.totalCount
    }

    return {
      isViewerJoined: snap.isViewerJoined,
      participantsCount: snap.participantsCount,
      totalCount,
      // @ts-expect-error
      participants: snap.participants,
    }
  }

  const getFoldState = (): TFoldState => {
    const { foldedCommentIds, pagedComments } = snap

    const isAllFolded =
      pagedComments.totalCount === 0 ? false : foldedCommentIds.length === pagedComments.totalCount

    return {
      foldedIds: foldedCommentIds,
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
        // @ts-expect-error
        'submitState',
        'updateId',
      ],
      snap,
    )

    // @ts-expect-error
    return { ...baseFields, replyToComment: snap.replyToComment }
  }

  const getRepliesState = (): TRepliesState => {
    return pick(['repliesParentId', 'repliesLoading'], snap)
  }

  return {
    getBasicState,
    getFoldState,
    getEditState,
    getRepliesState,
  }
}
