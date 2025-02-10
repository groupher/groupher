import type { TComment, TPagedComments, TUser } from '~/spec'

import type { TMode, TAPIMode, TEditMode } from '../spec'

export type TStore = {
  mode: TMode
  apiMode: TAPIMode
  editMode: TEditMode

  // toggle main comment box
  showEditor: boolean
  showUpdateEditor: boolean

  // toggle modal editor for reply
  showReplyEditor: boolean

  // content input of current comment editor
  commentBody: string
  // update comment
  updateId: string | null
  updateBody: string
  // reply comment
  // parrent comment of current reply
  replyToComment: TComment | null
  replyBody: string
  // content input of current reply comment editor
  wordsCountReady: boolean
  // comments pagination data of current COMMUNITY / PART
  pagedComments: TPagedComments
  pagedPublishedComments: TPagedComments

  // loadPagedReplies
  repliesParentId: string | null
  repliesLoading: boolean

  // toggle loading for creating comment
  publishing: boolean
  publishDone: boolean
  // toggle loading for comments list
  loading: boolean

  foldedCommentIds: stirng[]

  // basic states
  needRefreshState: boolean
  isViewerJoined: boolean
  participantsCount: number
  totalCount: number
  participants: TUser[]

  commit: (patch: Partial<TStore>) => void
}
