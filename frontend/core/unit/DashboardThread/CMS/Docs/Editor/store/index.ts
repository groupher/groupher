import { proxy } from 'valtio'

import type { TDocDraftInfo, TInit, TStore } from './spec'

const EMPTY_DOC_DRAFT_INFO: TDocDraftInfo = {
  id: '',
  title: '',
  slug: '',
  insertedAt: null,
  updatedAt: null,
  author: null,
  wordCount: 0,
  characterCount: 0,
}

export default function DocsEditorStore(init: TInit): TStore {
  // Docs editor actions are split across the tree, article, snackbar, and future drawers.
  // Keep cross-region session commands here so toolbar actions do not reach into SideTree props.
  let sideTree = init.sideTree
  let saveDocDraftHandler: (() => Promise<void>) | null = null

  const initialStore: TStore = {
    docDraftInfo: EMPTY_DOC_DRAFT_INFO,
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

    saveDocDraft: async (): Promise<void> => {
      await saveDocDraftHandler?.()
    },

    setDocDraftSession: (patch): void => {
      Object.assign(store, patch)
    },
  }

  const store = proxy(initialStore)
  return store
}
