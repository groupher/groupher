'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { browserQuery } from '~/graphql/client'
import useViewingArticle from '~/hooks/useViewingArticle'
import type { TComment } from '~/spec'
import useAccount from '~/stores/account/hooks'
import commentsSchema from '~/unit/Comments/schema'

import { commentKeys, mutationKeys, viewerKeys } from '../key'
import { patchCommentEverywhere, patchCommentViewerState } from './comment'

/** Owns per-comment moderation transport and cache effects. */
export default function useCommentModeration(comment: TComment) {
  const queryClient = useQueryClient()
  const account = useAccount()
  const { article } = useViewingArticle()
  const viewerScope = account.user?.login || ''
  const articleInput = {
    community: article.community.slug,
    thread: article.meta.thread,
    innerId: String(article.innerId),
  }
  const articleKey = `${articleInput.community}:${articleInput.thread}:${articleInput.innerId}`
  const commentInput = { article: articleInput, innerId: String(comment.innerId) }
  const commentKey = `${articleKey}:${comment.innerId}`

  const deleteMutation = useMutation({
    mutationKey: mutationKeys.comment(commentKey, 'delete'),
    scope: { id: `comment:${commentKey}:delete` },
    retry: false,
    mutationFn: async () => browserQuery(commentsSchema.deleteComment, { comment: commentInput }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all })
      const comments = queryClient.getQueriesData({ queryKey: commentKeys.all })
      patchCommentEverywhere(queryClient, comment.innerId, () => null)
      return { comments }
    },
    onError: (_error, _variables, snapshot) => {
      for (const [key, data] of snapshot?.comments || []) queryClient.setQueryData(key, data)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: commentKeys.all, refetchType: 'none' }),
  })

  const reportMutation = useMutation({
    mutationKey: mutationKeys.comment(commentKey, 'report'),
    scope: { id: `comment:${commentKey}:report` },
    retry: false,
    mutationFn: async () => {
      const { reportComment } = await browserQuery(commentsSchema.reportComment, {
        attr: null,
        comment: commentInput,
        reason: 'OTHER',
      })
      if (!reportComment) throw new Error('Report comment response is empty')
      return reportComment as unknown as TComment
    },
    onSuccess: (confirmed) => {
      if (!viewerScope) return
      patchCommentViewerState(queryClient, viewerScope, articleKey, comment.innerId, (current) => ({
        ...current,
        viewerHasReported:
          typeof confirmed.viewerHasReported === 'boolean' ? confirmed.viewerHasReported : true,
      }))
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: [...viewerKeys.all, viewerScope, 'comment-state', articleKey],
        refetchType: 'none',
      }),
  })

  return {
    deleteComment: () => deleteMutation.mutate(),
    reportComment: () => reportMutation.mutate(),
  }
}
