'use client'

import { useQueryClient } from '@tanstack/react-query'

import type { TComment } from '~/spec'

import { commentUpvoteOperation, selectCommentFromCache } from './comment'
import useOptimisticToggle from './optimistic/useOptimisticToggle'
import useCommentTarget from './useCommentTarget'

/** Binds the shared optimistic toggle to one Comment upvote. */
export default function useCommentUpvote(comment: TComment) {
  const queryClient = useQueryClient()
  const target = useCommentTarget(comment)
  const { visibleState, toggle } = useOptimisticToggle(commentUpvoteOperation, target)
  const visibleComment = selectCommentFromCache(queryClient, target.scope, comment)

  return {
    count: visibleComment.upvotesCount || 0,
    isUpvoted: Boolean(visibleState),
    toggle,
  }
}
