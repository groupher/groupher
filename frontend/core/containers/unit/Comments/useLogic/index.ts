//

import { equals, isEmpty, keys, pick, reject } from 'ramda'
import { useSnapshot } from 'valtio'

import type { TComment, TID } from '~/spec'
import persist from '~/utils/persist'

import type { TMode } from '../spec'
import type { TStore } from './spec'
import store from './store'
import useDrived, { type TRet as TDrived } from './useDrived'
import useQuery, { type TRet as TQuery } from './useQuery'

type TRet = {
  onModeChange: (mode: TMode) => void
  commentOnChange: (v: string) => void
  openEditor: () => void
  openReplyEditor: (comment: TComment) => void
  closeUpdateEditor: () => void
  setWordsCountState: (wordsCountReady: boolean) => void
  clearDraft: () => void
  onReplyEditorClose: () => void
  saveDraftIfNeed: (content) => void
  foldComment: (id: TID) => void
  expandComment: (id: TID) => void
  foldAllComments: () => void
  expandAllComments: () => void
  closeReplyEditor: () => void
} & TStore &
  TQuery &
  TDrived

export default (): TRet => {
  const snap = useSnapshot(store)
  const queryActions = useQuery()
  const drived = useDrived()

  const onModeChange = (mode: TMode): void => {
    snap.commit({ mode, needRefreshState: false })
    queryActions.loadComments()
  }

  const commentOnChange = (v: string): void => {
    snap.commit({ commentBody: v })
  }

  const openEditor = (): void => {
    // initDraftTimmer()

    snap.commit({ showEditor: true })
  }

  const openReplyEditor = (comment: TComment): void => {
    // initDraftTimmer()
    snap.commit({
      showReplyEditor: true,
      replyToComment: comment,
    })
  }

  const closeUpdateEditor = (): void => {
    snap.commit({ showUpdateEditor: false, updateId: null })
  }

  const setWordsCountState = (wordsCountReady: boolean): void => {
    snap.commit({ wordsCountReady })
  }

  const onReplyEditorClose = (): void => {
    snap.commit({ showReplyEditor: false })
  }

  const saveDraftIfNeed = (content): void => {
    if (isEmpty(content)) return
    const curDraftContent = persist.get('recentDraft')

    if (curDraftContent !== content) persist.set('recentDraft', content)
  }

  const clearDraft = (): void => persist.remove('recentDraft')

  const foldComment = (id: TID): void => {
    const foldedCommentIds = [id, ...snap.foldedCommentIds]
    snap.commit({ foldedCommentIds })
  }

  const expandComment = (id: TID): void => {
    const foldedCommentIds = reject(equals(id), snap.foldedCommentIds) as string[]
    snap.commit({ foldedCommentIds })
  }

  // 只在 timeline 模式可用
  const foldAllComments = (): void => {
    const foldedCommentIds = snap.pagedComments.entries.map((c) => c.id)
    snap.commit({ foldedCommentIds })
  }

  // 只在 timeline 模式可用
  const expandAllComments = (): void => snap.commit({ foldedCommentIds: [] })

  const closeReplyEditor = (): void => {
    snap.commit({ replyToComment: null })
  }

  return {
    ...queryActions,
    ...drived,
    onModeChange,
    onReplyEditorClose,
    saveDraftIfNeed,
    commentOnChange,
    openEditor,
    openReplyEditor,
    closeUpdateEditor,
    setWordsCountState,
    clearDraft,
    foldComment,
    expandComment,
    foldAllComments,
    expandAllComments,
    closeReplyEditor,
    ...pick(keys(snap), snap),
    // @ts-expect-error
    replyToComment: {
      ...snap.replyToComment,
    },
  }
}
