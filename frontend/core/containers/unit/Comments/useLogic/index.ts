import { useContext } from 'react'
import { useSnapshot } from 'valtio'

import { StoreContext as CommentsStoreContext } from '~/stores/comments/provider'
import type { TStore as TCommentsStore } from '~/stores/comments/spec'
import useDerived, { type TRet as TDrived } from './useDerived'
import useActions, { type TActions } from './useActions'

type TRet = TCommentsStore & TActions & TDrived

export default (): TRet => {
  const commentsStore = useContext(CommentsStoreContext) as any
  if (!commentsStore) {
    throw new Error('useLogic must be used within a Comments store provider')
  }
  const comments = useSnapshot(commentsStore) as any
  const actions = useActions()
  const derived = useDerived()

  return {
    ...comments,
    commit: commentsStore.commit,
    reset: commentsStore.reset,
    ...actions,
    ...derived,
    replyToComment: {
      ...comments.replyToComment,
    },
  }
}
