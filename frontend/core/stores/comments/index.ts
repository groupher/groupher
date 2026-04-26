import { proxy } from 'valtio'

import { EMPTY_PAGED_COMMENTS } from '~/const/utils'

import { API_MODE, MODE } from './constant'
import type { TInit, TStore } from './spec'

export default function CommentsStore(init: TInit = {}): TStore {
  const createInitialState = () => ({
    mode: MODE.REPLIES,
    apiMode: API_MODE.ARTICLE,

    pagedComments: EMPTY_PAGED_COMMENTS,
    pagedPublishedComments: EMPTY_PAGED_COMMENTS,

    repliesParentId: null,
    repliesLoading: false,
    repliesLoadingByParentId: {},
    loading: false,
    needRefreshState: true,

    isViewerJoined: false,
    participantsCount: 0,
    totalCount: -1,
    participants: [],

    initialized: false,

    showEditor: false,
    showUpdateEditor: false,
    showReplyEditor: false,

    commentBody: '{}',
    updateId: null,
    updateBody: '{}',
    replyToComment: null,
    replyBody: '{}',
    wordsCountReady: false,

    publishing: false,
    publishDone: false,

    foldedCommentIds: [],
  })

  const store = proxy<TStore>({
    ...createInitialState(),
    ...init,

    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },

    reset: (): void => {
      Object.assign(store, createInitialState())
    },
  } as TStore)

  return store
}
