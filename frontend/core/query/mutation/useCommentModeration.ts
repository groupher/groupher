'use client'

import type { TComment } from '~/spec'
import useAccount from '~/stores/account/hooks'

import { deleteCommentOperation, type TCommentTarget } from './comment'
import useOptimisticAction from './optimistic/useOptimisticAction'
import useCommentTarget from './useCommentTarget'

/** Binds comment moderation actions to the shared Action lifecycle. */
export default function useCommentModeration(comment: TComment) {
  const account = useAccount()
  const accountScope = account.accountScope
  const target: TCommentTarget = useCommentTarget(comment)
  const remove = useOptimisticAction(deleteCommentOperation, target)

  return {
    deleteComment: () => {
      if (!accountScope) return
      void remove.submit(undefined).catch(() => undefined)
    },
    isRemoving: remove.isSubmitting,
  }
}
