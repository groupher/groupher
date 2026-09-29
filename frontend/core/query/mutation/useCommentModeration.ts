'use client'

import type { TComment } from '~/spec'
import { getAccountRef } from '~/stores/account/accountRef'
import useAccount from '~/stores/account/hooks'

import { deleteCommentOperation, reportCommentOperation, type TCommentTarget } from './comment'
import useOptimisticAction from './optimistic/useOptimisticAction'
import useCommentTarget from './useCommentTarget'

/** Binds comment moderation actions to the shared Action lifecycle. */
export default function useCommentModeration(comment: TComment) {
  const account = useAccount()
  const accountRef = account.accountRef || getAccountRef(account.user)
  const target: TCommentTarget = useCommentTarget(comment)
  const remove = useOptimisticAction(deleteCommentOperation, target)
  const report = useOptimisticAction(reportCommentOperation, target)

  return {
    deleteComment: () => {
      if (!accountRef) return
      void remove.submit(undefined).catch(() => undefined)
    },
    reportComment: () => {
      if (!accountRef) return
      void report.submit(undefined).catch(() => undefined)
    },
    isRemoving: remove.isSubmitting,
    isReporting: report.isSubmitting,
  }
}
