'use client'

import type { TComment } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { deleteCommentOperation, type TCommentTarget } from './comment'
import useOptimisticAction from './optimistic/useOptimisticAction'
import useCommentTarget from './useCommentTarget'

/** Binds comment moderation actions to the shared Action lifecycle. */
export default function useCommentModeration(comment: TComment) {
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user)
  const target: TCommentTarget = useCommentTarget(comment)
  const remove = useOptimisticAction(deleteCommentOperation, target)

  return {
    deleteComment: () => {
      if (!accountRef) return
      void remove.submit(undefined).catch(() => undefined)
    },
    isRemoving: remove.isSubmitting,
  }
}
