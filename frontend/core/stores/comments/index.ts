import { proxy } from 'valtio'

import { API_MODE, MODE } from './constant'
import type { TInit, TStore } from './spec'

export default function CommentsStore(init: TInit = {}): TStore {
  const createInitialState = () => ({
    mode: MODE.REPLIES,
    apiMode: API_MODE.ARTICLE,
    page: 1,

    repliesParentId: null,
    repliesLoading: false,
    repliesLoadingByParentId: {},
    showEditor: false,
    showUpdateEditor: false,
    showReplyEditor: false,

    commentBody: '{}',
    updateInnerId: null,
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
