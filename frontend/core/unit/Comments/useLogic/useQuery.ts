import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type MutableRefObject, useContext, useEffect, useRef } from 'react'

import { ANCHOR } from '~/const/dom'
import { scrollIntoEle } from '~/dom'
import { browserQuery } from '~/graphql/client'
import useViewingArticle from '~/hooks/useViewingArticle'
import { stripCommentViewerState } from '~/lib/commentViewerState'
import { articleKeys, mutationKeys, Q, viewerKeys } from '~/query'
import { patchArticleEverywhere } from '~/query/mutation/article'
import {
  insertPendingComment,
  insertPendingReply,
  isCommentQueryForArticle,
  patchCommentEverywhere,
  reconcileCreatedComment,
} from '~/query/mutation/comment'
import type { TComment, TID } from '~/spec'
import useAccount from '~/stores/account/hooks'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/context'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'
import { isWordsCountValid } from '~/ui/WordsCounter/helper'
import uid from '~/utils/uid'

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

  const queryClient = useQueryClient()

  const isMountedRef = useRef(true)
  const commentsRequestRef = useRef(0)
  const repliesRequestRef = useRef(0)

  const articlePath = `${article.community?.slug || ''}:${article.meta.thread}:${article.innerId}`
  const commentScope = {
    community: article.community.slug,
    thread: article.meta.thread,
    articleInnerId: article.innerId,
  }
  const commentQueryFilter = {
    predicate: (query: Parameters<typeof isCommentQueryForArticle>[0]) =>
      isCommentQueryForArticle(query, commentScope),
  }
  const latestArticlePathRef = useRef(articlePath)

  useEffect(() => {
    latestArticlePathRef.current = articlePath
  }, [articlePath])

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

  const buildArticlePath = () => ({
    innerId: article.innerId,
    community: article.community?.slug,
    thread: article.meta.thread,
  })

  const buildCommentPath = (commentOrInnerId: TComment | TID) => ({
    article: buildArticlePath(),
    innerId: typeof commentOrInnerId === 'object' ? commentOrInnerId.innerId : commentOrInnerId,
  })

  const createCommentMutation = useMutation({
    mutationKey: mutationKeys.article(articlePath, 'create-comment'),
    scope: { id: `article:${articlePath}:create-comment` },
    retry: false,
    mutationFn: async ({
      articleInput,
      body,
    }: {
      articleInput: ReturnType<typeof buildArticlePath>
      body: string
      pending: TComment
    }) => {
      const { createComment } = await browserQuery(S.createComment, {
        article: articleInput,
        body,
      })
      if (!createComment) throw new Error('Create comment response is empty')
      return createComment
    },
    onMutate: async ({ pending }) => {
      await Promise.all([
        queryClient.cancelQueries(commentQueryFilter),
        queryClient.cancelQueries({ queryKey: articleKeys.all }),
      ])
      const comments = queryClient.getQueriesData(commentQueryFilter)
      const articles = queryClient.getQueriesData({ queryKey: articleKeys.all })
      insertPendingComment(queryClient, commentScope, pending)
      patchArticleEverywhere(queryClient, buildArticlePath(), (current) => ({
        ...current,
        commentsCount: current.commentsCount + 1,
      }))
      commentsStore.commit({ publishing: true })
      return { articles, comments }
    },
    onError: (_error, _variables, snapshot) => {
      for (const [key, data] of snapshot?.comments || []) queryClient.setQueryData(key, data)
      for (const [key, data] of snapshot?.articles || []) queryClient.setQueryData(key, data)
      commentsStore.commit({ publishing: false })
    },
    onSuccess: (payload, { pending }) => {
      reconcileCreatedComment(
        queryClient,
        commentScope,
        pending.innerId,
        stripCommentViewerState(payload.comment as unknown as TComment),
        buildArticlePath(),
        payload.article.commentsCount,
      )
      published()
      setTimeout(() => resetPublish(EDIT_MODE.CREATE), 500)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ ...commentQueryFilter, refetchType: 'none' })
      void queryClient.invalidateQueries({ queryKey: viewerKeys.all, refetchType: 'none' })
    },
  })

  const replyCommentMutation = useMutation({
    mutationKey: mutationKeys.article(articlePath, 'reply-comment'),
    scope: { id: `article:${articlePath}:reply-comment` },
    retry: false,
    mutationFn: async ({
      commentInput,
      body,
    }: {
      commentInput: ReturnType<typeof buildCommentPath>
      body: string
      parentId: TID
      pending: TComment
    }) => {
      const { replyComment } = await browserQuery(S.replyComment, {
        comment: commentInput,
        body,
      })
      if (!replyComment) throw new Error('Reply comment response is empty')
      return replyComment
    },
    onMutate: async ({ parentId, pending }) => {
      await Promise.all([
        queryClient.cancelQueries(commentQueryFilter),
        queryClient.cancelQueries({ queryKey: articleKeys.all }),
      ])
      const comments = queryClient.getQueriesData(commentQueryFilter)
      const articles = queryClient.getQueriesData({ queryKey: articleKeys.all })
      insertPendingReply(queryClient, commentScope, parentId, pending)
      patchArticleEverywhere(queryClient, buildArticlePath(), (current) => ({
        ...current,
        commentsCount: current.commentsCount + 1,
      }))
      commentsStore.commit({ publishing: true })
      return { articles, comments }
    },
    onError: (_error, _variables, snapshot) => {
      for (const [key, data] of snapshot?.comments || []) queryClient.setQueryData(key, data)
      for (const [key, data] of snapshot?.articles || []) queryClient.setQueryData(key, data)
      commentsStore.commit({ publishing: false })
    },
    onSuccess: (payload, { pending }) => {
      reconcileCreatedComment(
        queryClient,
        commentScope,
        pending.innerId,
        stripCommentViewerState(payload.comment as unknown as TComment),
        buildArticlePath(),
        payload.article.commentsCount,
      )
      published()
      setTimeout(() => resetPublish(EDIT_MODE.REPLY), 500)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ ...commentQueryFilter, refetchType: 'none' })
      void queryClient.invalidateQueries({ queryKey: viewerKeys.all, refetchType: 'none' })
    },
  })

  const updateCommentMutation = useMutation({
    mutationKey: mutationKeys.article(articlePath, 'update-comment'),
    scope: { id: `article:${articlePath}:update-comment` },
    retry: false,
    mutationFn: async ({
      commentInput,
      body,
    }: {
      commentInput: ReturnType<typeof buildCommentPath>
      body: string
    }) => {
      const { updateComment } = await browserQuery(S.updateComment, {
        comment: commentInput,
        body,
      })
      if (!updateComment) throw new Error('Update comment response is empty')
      return updateComment as unknown as TComment
    },
    onMutate: () => {
      commentsStore.commit({ publishing: true })
    },
    onError: () => {
      commentsStore.commit({ publishing: false })
    },
    onSuccess: (confirmed) => {
      patchCommentEverywhere(queryClient, commentScope, confirmed.innerId, (current) => ({
        ...current,
        ...stripCommentViewerState(confirmed),
      }))
      published()
      setTimeout(() => resetPublish(EDIT_MODE.UPDATE), 500)
    },
    onSettled: () => queryClient.invalidateQueries({ ...commentQueryFilter, refetchType: 'none' }),
  })

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
    browserQuery(S.oneComment, { comment: buildCommentPath(comment) }).then(({ oneComment }) => {
      commentsStore.commit({ updateInnerId: oneComment.innerId, updateBody: oneComment.body })
    })
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
    browserQuery(S.pagedCommentReplies, params).then(({ pagedCommentReplies }) => {
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

    const pendingId = `pending:${uid.gen()}`
    const pending = {
      innerId: pendingId,
      bodyHtml: replyBody,
      author: account.user,
      insertedAt: new Date().toISOString(),
      upvotesCount: 0,
      replies: [],
      emotions: [],
      replyToComment,
    } as unknown as TComment
    replyCommentMutation.mutate({
      body: replyBody,
      commentInput: buildCommentPath(replyToComment),
      parentId: replyToComment.innerId,
      pending,
    })
  }

  const createComment = (): void => {
    if (!isWordsCountValid(commentsStore.commentBody, 10, 1000)) return
    const pendingId = `pending:${uid.gen()}`
    const pending = {
      innerId: pendingId,
      bodyHtml: commentsStore.commentBody,
      author: account.user,
      insertedAt: new Date().toISOString(),
      upvotesCount: 0,
      replies: [],
      emotions: [],
    } as unknown as TComment
    createCommentMutation.mutate({
      articleInput: buildArticlePath(),
      body: commentsStore.commentBody,
      pending,
    })
  }

  const updateComment = (): void => {
    if (!isWordsCountValid(commentsStore.updateBody, 10, 1000)) return
    if (!commentsStore.updateInnerId) return

    updateCommentMutation.mutate({
      commentInput: buildCommentPath(commentsStore.updateInnerId),
      body: commentsStore.updateBody,
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
