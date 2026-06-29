import { proxy } from 'valtio'

import { EMPTY_EDITOR_VALUE } from '../Article/constant'
import { resolveDraftSession } from '../Article/helper'
import { DOC_EDITOR_MODE } from '../constant'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import { findChild } from '../SideTree/helper'
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

export default function DocsEditorStore(init: TInit): TStore {
  // Docs editor actions are split across the tree, article, snackbar, and future drawers.
  // Keep cross-region session commands here so toolbar actions do not reach into SideTree props.
  let sideTree = init.sideTree
  let saveDocDraftHandler: (() => Promise<void>) | null = null
  const activeChild = sideTree.activeId ? findChild(sideTree.groups, sideTree.activeId) : null
  const activePage =
    activeChild?.type === SIDE_TREE_NODE_TYPE.PAGE && activeChild.workspaceId ? activeChild : null
  const initialArticleSession =
    activePage && String(init.article?.id) === String(activePage.workspaceId)
      ? resolveDraftSession(init.article, activePage)
      : null

  const initialStore: TStore = {
    baselineValue: initialArticleSession?.body ?? EMPTY_EDITOR_VALUE,
    bodyValue: initialArticleSession?.body ?? EMPTY_EDITOR_VALUE,
    docDraftInfo: initialArticleSession?.info ?? EMPTY_DOC_DRAFT_INFO,
    mode: DOC_EDITOR_MODE.EDIT,
    revisionReloadKey: 0,
    saveError: null,
    saveStatus: initialArticleSession ? 'saved' : 'idle',

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
