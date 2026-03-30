import { type MutableRefObject, useContext, useEffect, useRef } from 'react'
import { ANCHOR } from '~/const/dom'
import { scrollIntoEle } from '~/dom'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useViewingArticle from '~/hooks/useViewingArticle'
import type { TComment, TEmotion, TEmotionType, TID } from '~/spec'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/provider'
import uid from '~/utils/uid'

import { API_MODE, EDIT_MODE } from '../constant'
import S from '../schema'
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
  handleEmotion: (comment: TComment, name: TEmotionType, viewerHasReacted: boolean) => void
  handleUpvote: (comment: TComment, viewerHasUpvoted: boolean) => void
  replyComment: () => void
  updateComment: () => void
}

let repliesPagiNo = {}
const PAGI_SIZE = 30

export default function useQuery(): TRet {
  const commentsStore = useContext(CommentsStoreContext) as any
  if (!commentsStore) {
    throw new Error('useQuery must be used within a Comments store provider')
  }
  const { article } = useViewingArticle()
  const { addToReplies, upvoteEmotion, updateOneComment, published, resetPublish } = useHelper()

  const { query, mutate } = useGraphQLClient()

  const isMountedRef = useRef(true)
  const commentsRequestRef = useRef(0)
  const stateRequestRef = useRef(0)
  const repliesRequestRef = useRef(0)

  const articleKey = `${article.community?.slug || article.communitySlug || ''}:${article.meta.thread}:${article.innerId}`
  const latestArticleKeyRef = useRef(articleKey)

  useEffect(() => {
    latestArticleKeyRef.current = articleKey
  }, [articleKey])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      commentsRequestRef.current += 1
      stateRequestRef.current += 1
      repliesRequestRef.current += 1
    }
  }, [])

  const shouldIgnoreResult = (
    requestId: number,
    requestRef: MutableRefObject<number>,
    requestArticleKey: string,
  ): boolean => {
    return (
      !isMountedRef.current ||
      requestId !== requestRef.current ||
      requestArticleKey !== latestArticleKeyRef.current
    )
  }

  const buildArticleRef = () => ({
    innerId: article.innerId,
    community: article.community?.slug || article.communitySlug,
    thread: article.meta.thread,
  })

  const loadCommentsState = (): void => {
    const requestArticleKey = latestArticleKeyRef.current
    const requestId = stateRequestRef.current + 1
    stateRequestRef.current = requestId

    const params = {
      article: buildArticleRef(),
      freshkey: uid.gen(),
    }

    // console.log('## loadCommentsState args: ', params)
    query(S.commentsState, params).then(({ commentsState }) => {
      if (shouldIgnoreResult(requestId, stateRequestRef, requestArticleKey)) return
      commentsStore.commit({ ...commentsState })
    })
  }

  const loadPublishedComments = (_page = 1): void => {
    console.log('## TODO')
  }

  const loadComments = (page = 1): void => {
    const requestArticleKey = latestArticleKeyRef.current
    const requestId = commentsRequestRef.current + 1
    commentsRequestRef.current = requestId

    commentsStore.commit({ loading: true })

    const params = {
      article: buildArticleRef(),
      mode: commentsStore.mode,
      filter: { page, size: PAGI_SIZE },
    }
    // console.log('## loadComments args: ', params)

    query(S.pagedComments, params)
      .then(({ pagedComments }) => {
        if (shouldIgnoreResult(requestId, commentsRequestRef, requestArticleKey)) return

        repliesPagiNo = {}
        commentsStore.commit({ pagedComments, loading: false, initialized: true })

        if (commentsStore.needRefreshState) {
          loadCommentsState()
        }
      })
      .catch(() => {
        if (shouldIgnoreResult(requestId, commentsRequestRef, requestArticleKey)) return
        commentsStore.commit({ loading: false })
      })
  }

  const openUpdateEditor = (comment: TComment): void => {
    commentsStore.commit({ showUpdateEditor: true })
    query(S.oneComment, { id: comment.id }).then(({ oneComment }) => {
      commentsStore.commit({ updateId: oneComment.id, updateBody: oneComment.body })
    })
  }

  const _getRepliesPagiNo = (parentId: TID): number => {
    const curNo = repliesPagiNo[parentId]

    return curNo ? curNo + 1 : 1
  }

  const loadCommentReplies = (id: TID): void => {
    const requestArticleKey = latestArticleKeyRef.current
    const requestId = repliesRequestRef.current + 1
    repliesRequestRef.current = requestId

    const filter = { page: _getRepliesPagiNo(id), size: 30 }
    const params = { id, filter }

    commentsStore.commit({
      repliesParentId: id,
      repliesLoading: true,
      repliesLoadingByParentId: {
        ...commentsStore.repliesLoadingByParentId,
        [id]: true,
      },
    })
    console.log('## loadCommentReplies args: ', params)
    query(S.pagedCommentReplies, params).then(({ pagedCommentReplies }) => {
      if (shouldIgnoreResult(requestId, repliesRequestRef, requestArticleKey)) return

      addToReplies(id, pagedCommentReplies.entries)

      repliesPagiNo[id] = pagedCommentReplies.pageNumber
      commentsStore.commit({
        repliesParentId: null,
        repliesLoading: false,
        repliesLoadingByParentId: {
          ...commentsStore.repliesLoadingByParentId,
          [id]: false,
        },
      })
    })
  }

  /**
   * load the same mode when page change
   */
  const onPageChange = (page = 1): void => {
    const { apiMode } = commentsStore
    if (apiMode === API_MODE.ARTICLE) {
      commentsStore.commit({ needRefreshState: false })
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
    viewerHasReacted: boolean,
  ): void => {
    const { id } = comment
    const emotion = name.toUpperCase()
    const nextEmotions = updateEmotionState(comment.emotions || [], name, !viewerHasReacted)

    if (viewerHasReacted) {
      upvoteEmotion(comment, nextEmotions)
      mutate(S.undoEmotionToComment, { id, emotion }).then(({ undoEmotionToComment }) => {
        upvoteEmotion(undoEmotionToComment, undoEmotionToComment.emotions)
      })
    } else {
      upvoteEmotion(comment, nextEmotions)
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
    const { replyToComment, replyBody } = commentsStore
    const params = { id: replyToComment.id, body: replyBody }
    commentsStore.commit({ publishing: true })
    mutate(S.replyComment, params).then(() => {
      commentsStore.commit({ needRefreshState: true })
      loadComments()
      published()
      setTimeout(() => resetPublish(EDIT_MODE.REPLY), 500)
      // stopDraftTimmer()
      // clearDraft()
    })
  }

  const updateComment = (): void => {
    if (!commentsStore.wordsCountReady) return

    const params = {
      id: commentsStore.updateId,
      body: commentsStore.updateBody,
    }

    console.log('## updateComment params: ', params)
    commentsStore.commit({ publishing: true })
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

const updateEmotionState = (
  emotions: TEmotion[],
  name: TEmotionType,
  nextViewerState: boolean,
): TEmotion[] => {
  const emotionType = name.toUpperCase() as TEmotion['type']
  const index = emotions.findIndex((item) => item.type === emotionType)

  if (index < 0) {
    return [
      ...emotions,
      {
        type: emotionType,
        count: nextViewerState ? 1 : 0,
        viewerHasReacted: nextViewerState,
        latestUsers: [],
      },
    ]
  }

  return emotions.map((item, itemIndex) => {
    if (itemIndex !== index) return item

    const count = item.count || 0

    return {
      ...item,
      count: nextViewerState ? count + 1 : Math.max(count - 1, 0),
      viewerHasReacted: nextViewerState,
    }
  })
}
