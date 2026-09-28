import { useQueryClient } from '@tanstack/react-query'
import { type MutableRefObject, useContext, useEffect, useRef } from 'react'

import { ANCHOR } from '~/const/dom'
import { scrollIntoEle } from '~/dom'
import { browserGraphQLRequest } from '~/graphql/client'
import useViewingArticle from '~/hooks/useViewingArticle'
import { Q } from '~/query'
import { articlePathKey, articlePathOf } from '~/query/articlePath'
import {
  createCommentOperation,
  replyCommentOperation,
  updateCommentOperation,
} from '~/query/mutation/comment'
import useOptimisticAction from '~/query/mutation/optimistic/useOptimisticAction'
import type { TComment, TID } from '~/spec'
import useAccount from '~/stores/account/hooks'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/context'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'
import { isWordsCountValid } from '~/ui/WordsCounter/helper'

import { API_MODE, EDIT_MODE } from '../constant'
import S from '../schema'
import useHelper from './useHelper'

//
export type TRet = {
  loadComments: (page?: number) => void
  loadCommentReplies: (innerId: TID) => void
  createComment: () => void
  openUpdateEditor: (comment: TComment) => void
  onPageChange: (page: number) => void
  onMentionSearch: (name: string) => void
  replyComment: () => void
  updateComment: () => void
}

let repliesPagiNo: Record<string, number> = {}

/** Exposes query state and actions through the shared React hook boundary. */
export default function useQuery(): TRet {
  const commentsStore = useContext(CommentsStoreContext) as TCommentsStore | null
  if (!commentsStore) {
    throw new Error('useQuery must be used within a Comments store provider')
  }
  const { article } = useViewingArticle()
  const account = useAccount()
  const { addToReplies, published, resetPublish } = useHelper()
  const { replyToComment } = commentsStore

  const queryClient = useQueryClient()

  const isMountedRef = useRef(true)
  const commentsRequestRef = useRef(0)
  const repliesRequestRef = useRef(0)

  const articleKey = articlePathKey(articlePathOf(article))
  const commentScope = {
    community: article.community.slug,
    thread: article.meta.thread,
    articleInnerId: article.innerId,
  }
  const latestArticlePathRef = useRef(articleKey)

  useEffect(() => {
    latestArticlePathRef.current = articleKey
  }, [articleKey])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      commentsRequestRef.current += 1
      repliesRequestRef.current += 1
    }
  }, [])

  const shouldIgnoreResult = (
    requestId: number,
    requestRef: MutableRefObject<number>,
    requestArticlePath: string,
  ): boolean => {
    return (
      !isMountedRef.current ||
      requestId !== requestRef.current ||
      requestArticlePath !== latestArticlePathRef.current
    )
  }

  const buildArticlePath = () => articlePathOf(article)

  const buildCommentPath = (commentOrInnerId: TComment | TID) => ({
    article: buildArticlePath(),
    innerId: typeof commentOrInnerId === 'object' ? commentOrInnerId.innerId : commentOrInnerId,
  })

  const createAction = useOptimisticAction(createCommentOperation, {
    scope: commentScope,
    articlePath: buildArticlePath(),
    articleKey,
    author: account.user,
  })
  const replyAction = useOptimisticAction(
    replyCommentOperation,
    replyToComment
      ? {
          scope: commentScope,
          articlePath: buildArticlePath(),
          articleKey,
          author: account.user,
          parentId: String(replyToComment.innerId),
          parent: replyToComment,
        }
      : null,
  )
  const updateAction = useOptimisticAction(
    updateCommentOperation,
    commentsStore.updateInnerId
      ? {
          comment: { innerId: String(commentsStore.updateInnerId) } as TComment,
          scope: commentScope,
          articlePath: buildArticlePath(),
          articleKey,
          commentInnerId: String(commentsStore.updateInnerId),
          commentPath: buildCommentPath(commentsStore.updateInnerId),
        }
      : null,
  )

  const loadComments = (page = 1): void => {
    commentsStore.commit({ page })
    repliesPagiNo = {}
    void queryClient.fetchQuery(
      Q.comment.list(
        article.community.slug,
        article.meta.thread,
        article.innerId,
        page,
        commentsStore.mode,
      ),
    )
  }

  const openUpdateEditor = (comment: TComment): void => {
    commentsStore.commit({ showUpdateEditor: true })
    browserGraphQLRequest(S.oneComment, { comment: buildCommentPath(comment) }).then(
      ({ oneComment }) => {
        commentsStore.commit({ updateInnerId: oneComment.innerId, updateBody: oneComment.body })
      },
    )
  }

  const _getRepliesPagiNo = (parentId: TID): number => {
    const curNo = repliesPagiNo[parentId]

    return curNo ? curNo + 1 : 1
  }

  const loadCommentReplies = (innerId: TID): void => {
    const requestArticlePath = latestArticlePathRef.current
    const requestId = repliesRequestRef.current + 1
    repliesRequestRef.current = requestId

    const filter = { page: _getRepliesPagiNo(innerId), size: 30 }
    const params = { comment: buildCommentPath(innerId), filter }

    commentsStore.commit({
      repliesParentId: innerId,
      repliesLoading: true,
      repliesLoadingByParentId: {
        ...commentsStore.repliesLoadingByParentId,
        [innerId]: true,
      },
    })
    console.log('## loadCommentReplies args: ', params)
    browserGraphQLRequest(S.pagedCommentReplies, params).then(({ pagedCommentReplies }) => {
      if (shouldIgnoreResult(requestId, repliesRequestRef, requestArticlePath)) return

      addToReplies(innerId, pagedCommentReplies.entries as unknown as TComment[])

      repliesPagiNo[innerId] = pagedCommentReplies.pageNumber
      commentsStore.commit({
        repliesParentId: null,
        repliesLoading: false,
        repliesLoadingByParentId: {
          ...commentsStore.repliesLoadingByParentId,
          [innerId]: false,
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
      commentsStore.commit({ page })
      loadComments(page)
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

  const replyComment = (): void => {
    const { replyToComment, replyBody } = commentsStore
    if (!replyToComment) return

    commentsStore.commit({ publishing: true })
    void replyAction
      .submit(replyBody)
      .then(() => {
        published()
        setTimeout(() => resetPublish(EDIT_MODE.REPLY), 500)
      })
      .catch(() => {
        commentsStore.commit({ publishing: false })
      })
  }

  const createComment = (): void => {
    if (!isWordsCountValid(commentsStore.commentBody, 10, 1000)) return
    commentsStore.commit({ publishing: true })
    void createAction
      .submit(commentsStore.commentBody)
      .then(() => {
        published()
        setTimeout(() => resetPublish(EDIT_MODE.CREATE), 500)
      })
      .catch(() => {
        commentsStore.commit({ publishing: false })
      })
  }

  const updateComment = (): void => {
    if (!isWordsCountValid(commentsStore.updateBody, 10, 1000)) return
    if (!commentsStore.updateInnerId) return

    commentsStore.commit({ publishing: true })
    void updateAction
      .submit(commentsStore.updateBody)
      .then(() => {
        published()
        setTimeout(() => resetPublish(EDIT_MODE.UPDATE), 500)
      })
      .catch(() => {
        commentsStore.commit({ publishing: false })
      })
  }

  return {
    loadComments,
    loadCommentReplies,
    createComment,
    openUpdateEditor,
    onPageChange,
    onMentionSearch,
    replyComment,
    updateComment,
  }
}
