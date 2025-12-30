import { useSnapshot } from 'valtio'
import { ANCHOR } from '~/const/dom'
import { scrollIntoEle } from '~/dom'
import { titleCase } from '~/fmt'
import useViewingArticle from '~/hooks/useViewingArticle'
import { mutate, query } from '~/server'
import type { TComment, TEmotionType, TID } from '~/spec'
import uid from '~/utils/uid'

import { API_MODE, EDIT_MODE } from '../constant'
import S from '../schema'
import store from './store'
import useHelper from './useHelper'

//
export type TRet = {
  loadComments: (page?: number) => void
  loadCommentReplies: (id: TID) => void
  loadCommentsState: () => void
  loadPublishedComments: () => void
  openUpdateEditor: (comment: TComment) => void
  onPageChange: (page: number) => void
  onMentionSearch: (name: string) => void
  deleteComment: () => void
  handleEmotion: (comment: TComment, name: TEmotionType, viewerHasEmotioned: boolean) => void
  handleUpvote: (comment: TComment, viewerHasUpvoted: boolean) => void
  replyComment: () => void
  updateComment: () => void
}

let repliesPagiNo = {}
const PAGI_SIZE = 30

export default (): TRet => {
  const snap = useSnapshot(store)
  const { article } = useViewingArticle()
  const { addToReplies, upvoteEmotion, updateOneComment, published, resetPublish } = useHelper()

  const loadCommentsState = (): void => {
    const params = {
      id: article.id,
      thread: article.meta.thread,
      freshkey: uid.gen(),
    }

    // console.log('## loadCommentsState args: ', params)
    query(S.commentsState, params).then(({ commentsState }) => {
      snap.commit({ ...commentsState })
    })
  }

  const loadPublishedComments = (_page = 1): void => {
    console.log('## TODO')
  }

  const loadComments = (page = 1): void => {
    snap.commit({ loading: true })

    const params = {
      id: article.innerId,
      thread: article.meta.thread,
      mode: snap.mode,
      filter: { page, size: PAGI_SIZE },
    }
    // console.log('## loadComments args: ', params)

    query(S.pagedComments, params).then(({ pagedComments }) => {
      repliesPagiNo = {}
      snap.commit({ pagedComments, loading: false })

      if (snap.needRefreshState) {
        loadCommentsState()
      }
    })
  }

  const openUpdateEditor = (comment: TComment): void => {
    snap.commit({ showUpdateEditor: true })
    query(S.oneComment, { id: comment.id }).then(({ oneComment }) => {
      snap.commit({ updateId: oneComment.id, updateBody: oneComment.body })
    })
  }

  const _getRepliesPagiNo = (parentId: TID): number => {
    const curNo = repliesPagiNo[parentId]

    return curNo ? curNo + 1 : 1
  }

  const loadCommentReplies = (id: TID): void => {
    const filter = { page: _getRepliesPagiNo(id), size: 30 }
    const params = { id, filter }

    snap.commit({ repliesParentId: id, repliesLoading: true })
    console.log('## loadCommentReplies args: ', params)
    query(S.pagedCommentReplies, params).then(({ pagedCommentReplies }) => {
      addToReplies(pagedCommentReplies.entries)

      repliesPagiNo[snap.repliesParentId] = pagedCommentReplies.pageNumber
      snap.commit({ repliesParentId: null, repliesLoading: false })
    })
  }

  /**
   * load the same mode when page change
   */
  const onPageChange = (page = 1): void => {
    const { apiMode } = snap
    if (apiMode === API_MODE.ARTICLE) {
      snap.commit({ needRefreshState: false })
      loadComments(page)
    } else {
      loadPublishedComments(page)
    }

    scrollIntoEle(ANCHOR.COMMENTS_ID)
  }

  const onMentionSearch = (_name: string): void => {
    console.log('## TODO: onMentionSearch')
    // if (name?.length >= 1) {
    //   query(S.searchUsers, { name })
    // } else {
    //   snap.updateMentionList([])
    // }
  }

  const deleteComment = (): void => {
    console.log('## TODO: deleteComment')
    // mutate(S.deleteComment, {
    //   thread: snap.activeThread,
    // })
  }

  const handleEmotion = (
    comment: TComment,
    name: TEmotionType,
    viewerHasEmotioned: boolean,
  ): void => {
    const { id } = comment
    const emotion = name.toUpperCase()

    // comment.emotions
    if (viewerHasEmotioned) {
      // instantFresh
      const emotionInfo = {
        // @ts-expect-error
        [`${name}Count`]: comment.emotions[`${name}Count`] - 1,
        [`viewerHas${titleCase(name)}ed`]: false,
      }
      upvoteEmotion(comment, emotionInfo)
      mutate(S.undoEmotionToComment, { id, emotion }).then(({ undoEmotionToComment }) => {
        upvoteEmotion(undoEmotionToComment, undoEmotionToComment.emotions)
      })
    } else {
      const emotionInfo = {
        // @ts-expect-error
        [`${name}Count`]: comment.emotions[`${name}Count`] + 1,
        [`viewerHas${titleCase(name)}ed`]: true,
      }
      upvoteEmotion(comment, emotionInfo)
      // instantFresh
      mutate(S.emotionToComment, { id, emotion }).then(({ emotionToComment }) => {
        upvoteEmotion(emotionToComment, emotionToComment.emotions)
      })
    }
  }

  const handleUpvote = (comment: TComment, viewerHasUpvoted: boolean): void => {
    const { id, upvotesCount } = comment

    const updateBack = (upvoteComment: TComment) => {
      const { upvotesCount, viewerHasUpvoted, meta } = upvoteComment

      updateOneComment(upvoteComment, {
        upvotesCount,
        viewerHasUpvoted,
        meta,
      })
    }

    if (viewerHasUpvoted) {
      updateOneComment(comment, {
        upvotesCount: upvotesCount + 1,
        viewerHasUpvoted: !viewerHasUpvoted,
      })
      mutate(S.upvoteComment, { id }).then(({ upvoteComment }) => updateBack(upvoteComment))
    } else {
      updateOneComment(comment, {
        upvotesCount: upvotesCount - 1,
        viewerHasUpvoted: !viewerHasUpvoted,
      })

      mutate(S.undoUpvoteComment, { id }).then(({ undoUpvoteComment }) => {
        updateBack(undoUpvoteComment)
      })
    }
  }

  const replyComment = (): void => {
    const { replyToComment, replyBody } = snap
    const params = { id: replyToComment.id, body: replyBody }
    snap.commit({ publishing: true })
    mutate(S.replyComment, params).then(() => {
      snap.commit({ needRefreshState: true })
      loadComments()
      published()
      setTimeout(() => resetPublish(EDIT_MODE.REPLY), 500)
      // stopDraftTimmer()
      // clearDraft()
    })
  }

  const updateComment = (): void => {
    if (!snap.wordsCountReady) return

    const params = {
      id: store.updateId,
      body: store.updateBody,
    }

    console.log('## updateComment params: ', params)
    snap.commit({ publishing: true })
    mutate(S.updateComment, params).then(({ updateComment }) => {
      published()
      const { bodyHtml } = updateComment
      updateOneComment(updateComment, { bodyHtml })

      setTimeout(() => resetPublish(EDIT_MODE.UPDATE), 500)
    })
  }

  return {
    loadComments,
    loadCommentReplies,
    loadCommentsState,
    loadPublishedComments,
    openUpdateEditor,
    onPageChange,
    onMentionSearch,
    deleteComment,
    handleEmotion,
    handleUpvote,
    replyComment,
    updateComment,
  }
}
