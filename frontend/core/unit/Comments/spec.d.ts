import type { TAccount, TComment, TID, TSubmitState, TPagedComments, TUser } from '~/spec'

import type { EDIT_MODE, MODE } from './constant'

export type TMode = `${MODE}`
export type TAPIMode = 'article' | 'user_published'
export type TEditMode = `${EDIT_MODE}`

export type TFoldState = {
  isAllFolded: boolean
  foldedIds: TID[]
}

export type TEditState = {
  commentBody: string
  updateBody: string
  replyBody: string
  showEditor: boolean
  showReplyEditor: boolean
  showUpdateEditor: boolean
  submitState: TSubmitState
  updateId: TID | null
  replyToComment: TComment | null
}

export type TRepliesState = {
  repliesParentId: TID | null
  repliesLoading: boolean
}
