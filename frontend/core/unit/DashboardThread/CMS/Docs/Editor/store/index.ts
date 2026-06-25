import { proxy } from 'valtio'

import { DOC_EDITOR_MODE } from '../constant'
import type { TDocDraftInfo, TInit, TStore } from './spec'

const EMPTY_DOC_DRAFT_INFO: TDocDraftInfo = {
  id: '',
  title: '',
  subtitle: '',
  slug: '',
  insertedAt: null,
  updatedAt: null,
  author: null,
  publishState: null,
  wordCount: 0,
  characterCount: 0,
}

const EMPTY_EDITOR_VALUE = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
]

export default function DocsEditorStore(init: TInit): TStore {
  // Docs editor actions are split across the tree, article, snackbar, and future drawers.
  // Keep cross-region session commands here so toolbar actions do not reach into SideTree props.
  let sideTree = init.sideTree
  let saveDocDraftHandler: (() => Promise<void>) | null = null

  const initialStore: TStore = {
    baselineValue: EMPTY_EDITOR_VALUE,
    bodyValue: EMPTY_EDITOR_VALUE,
    docDraftInfo: EMPTY_DOC_DRAFT_INFO,
    mode: DOC_EDITOR_MODE.EDIT,
    revisionReloadKey: 0,
    saveError: null,
    saveStatus: 'idle',

    addGroup: (): void => {
      sideTree.addGroup()
    },

    attachSideTree: (nextSideTree): void => {
      sideTree = nextSideTree
    },

    attachSaveDocDraft: (handler): void => {
      saveDocDraftHandler = handler
    },

    reloadDocDraft: (): void => {
      store.revisionReloadKey += 1
    },

    reloadSideTree: (): void => {
      sideTree.reload()
    },

    saveDocDraft: async (): Promise<void> => {
      await saveDocDraftHandler?.()
    },

    setMode: (mode): void => {
      store.mode = mode
    },

    setDocDraftSession: (patch): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
