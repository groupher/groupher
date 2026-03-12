import { equals, isEmpty, reject } from 'ramda'
import { useContext } from 'react'

import type { TComment, TID } from '~/spec'
import { StoreContext as CommentsStoreContext } from '~/stores/comments/provider'
import persist from '~/utils/persist'

import type { TMode } from '../spec'
import useQuery from './useQuery'

export type TActions = {
  onModeChange: (mode: TMode) => void
  commentOnChange: (v: string) => void
  openEditor: () => void
  openReplyEditor: (comment: TComment) => void
  closeUpdateEditor: () => void
  setWordsCountState: (wordsCountReady: boolean) => void
  clearDraft: () => void
  onReplyEditorClose: () => void
  saveDraftIfNeed: (content: string) => void
  foldComment: (id: TID) => void
  expandComment: (id: TID) => void
  foldAllComments: () => void
  expandAllComments: () => void
  closeReplyEditor: () => void
} & ReturnType<typeof useQuery>

export default (): TActions => {
  const commentsStore = useContext(CommentsStoreContext) as any
  if (!commentsStore) {
    throw new Error('useActions must be used within a Comments store provider')
  }

  const queryActions = useQuery()

  const onModeChange = (mode: TMode): void => {
    commentsStore.commit({ mode, needRefreshState: false })
    queryActions.loadComments()
  }

  const commentOnChange = (v: string): void => {
    commentsStore.commit({ commentBody: v })
  }

  const openEditor = (): void => {
    commentsStore.commit({ showEditor: true })
  }

  const openReplyEditor = (comment: TComment): void => {
    commentsStore.commit({
      showReplyEditor: true,
      replyToComment: comment,
    })
  }

  const closeUpdateEditor = (): void => {
    commentsStore.commit({ showUpdateEditor: false, updateId: null })
  }

  const setWordsCountState = (wordsCountReady: boolean): void => {
    commentsStore.commit({ wordsCountReady })
  }

  const onReplyEditorClose = (): void => {
    commentsStore.commit({ showReplyEditor: false })
  }

  const saveDraftIfNeed = (content: string): void => {
    if (isEmpty(content)) return
    const curDraftContent = persist.get('recentDraft')

    if (curDraftContent !== content) persist.set('recentDraft', content)
  }

  const clearDraft = (): void => persist.remove('recentDraft')

  const foldComment = (id: TID): void => {
    const foldedCommentIds = [id, ...commentsStore.foldedCommentIds]
    commentsStore.commit({ foldedCommentIds })
  }

  const expandComment = (id: TID): void => {
    const foldedCommentIds = reject(equals(id), commentsStore.foldedCommentIds) as string[]
    commentsStore.commit({ foldedCommentIds })
  }

  const foldAllComments = (): void => {
    const foldedCommentIds = commentsStore.pagedComments.entries.map((c) => c.id)
    commentsStore.commit({ foldedCommentIds })
  }

  const expandAllComments = (): void => commentsStore.commit({ foldedCommentIds: [] })

  const closeReplyEditor = (): void => {
    commentsStore.commit({ replyToComment: null })
  }

  return {
    ...queryActions,
    onModeChange,
    commentOnChange,
    openEditor,
    openReplyEditor,
    closeUpdateEditor,
    setWordsCountState,
    clearDraft,
    onReplyEditorClose,
    saveDraftIfNeed,
    foldComment,
    expandComment,
    foldAllComments,
    expandAllComments,
    closeReplyEditor,
  }
}
