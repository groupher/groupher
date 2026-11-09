import { proxy } from 'valtio'

import { API_MODE, MODE } from './constant'
import type { TInit, TStore } from './spec'

/** Creates an isolated reactive Comments store with resettable editor and list state. */
export default function createCommentsStore(init: TInit = {}): TStore {
  const createInitialState = () => ({
    mode: MODE.REPLIES,
    apiMode: API_MODE.ARTICLE,

    showEditor: false,
    showUpdateEditor: false,
    showReplyEditor: false,

    commentBody: '{}',
    updateInnerId: null,
    updateBody: '{}',
    updateBodyVersion: null,
    replyToComment: null,
    replyBody: '{}',
    wordsCountReady: false,

    publishing: false,
    publishDone: false,

    foldedCommentIds: [],
    expandedCommentIds: [],
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
