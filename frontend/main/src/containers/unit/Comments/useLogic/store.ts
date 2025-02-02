import { proxy } from 'valtio'
import { mergeDeepRight } from 'ramda'

import type { TStore } from './spec'
import { EMPTY_PAGED_COMMENTS } from '~/const/utils'

import { MODE, EDIT_MODE, API_MODE } from '../constant'

const store = proxy<TStore>({
  mode: MODE.REPLIES,
  apiMode: API_MODE.ARTICLE,
  editMode: EDIT_MODE.CREATE,

  // toggle main comment box
  showEditor: false,
  showUpdateEditor: false,

  // toggle modal editor for reply
  showReplyEditor: false,

  // content input of current comment editor
  commentBody: '{}',
  // update comment
  updateId: null,
  updateBody: '{}',
  // reply comment
  // parrent comment of current reply
  replyToComment: null,
  replyBody: '{}',
  // content input of current reply comment editor
  wordsCountReady: false,
  // comments pagination data of current COMMUNITY / PART
  pagedComments: EMPTY_PAGED_COMMENTS,
  pagedPublishedComments: EMPTY_PAGED_COMMENTS,

  // loadPagedReplies
  repliesParentId: null,
  repliesLoading: false,

  // toggle loading for creating comment
  publishing: false,
  publishDone: false,
  // toggle loading for comments list
  loading: false,

  foldedCommentIds: [],

  // basic states
  needRefreshState: true,
  isViewerJoined: false,
  participantsCount: 0,
  totalCount: -1,
  participants: [],

  commit: (patch: Partial<TStore>): void => {
    Object.assign(store, mergeDeepRight(store, patch))
  },
})

export default store
