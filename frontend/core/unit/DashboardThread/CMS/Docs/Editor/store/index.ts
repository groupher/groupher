import { proxy } from 'valtio'

import { EMPTY_EDITOR_VALUE } from '../Article/constant'
import { resolveDraftSession } from '../Article/helper'
import { DOC_EDITOR_MODE } from '../constant'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import { findChild, needsPublishAttention } from '../SideTree/helper'
import type { TSideTreeController } from '../SideTree/spec'
import type {
  TDocDraftInfo,
  TDocPublishRuntime,
  TDocPublishView,
  TDocSaveStatus,
  TInit,
  TStore,
} from './spec'

const EMPTY_DOC_DRAFT_INFO: TDocDraftInfo = {
  id: '',
  title: '',
  subtitle: '',
  slug: '',
  stage: null,
  insertedAt: null,
  updatedAt: null,
  author: null,
  publishState: null,
  wordCount: 0,
  characterCount: 0,
}

const DEFAULT_PUBLISH_RUNTIME: TDocPublishRuntime = {
  isPublishing: false,
  scopeLoaded: false,
  publishCount: 0,
  hasSelectableScopeItems: false,
}

const hasTreeChanges = (sideTree: TSideTreeController): boolean => {
  return (
    sideTree.treeState?.hasUnpublishedChanges === true ||
    (sideTree.treeState?.stagedEventCount ?? 0) > 0 ||
    sideTree.groups.some((group) => needsPublishAttention(group.publishState))
  )
}

const hasNodeChanges = (sideTree: TSideTreeController): boolean => {
  return sideTree.groups.some((group) =>
    group.children.some((child) => needsPublishAttention(child.publishState)),
  )
}

const buildPublishView = (
  sideTree: TSideTreeController,
  saveStatus: TDocSaveStatus,
  runtime: TDocPublishRuntime,
): TDocPublishView => {
  const activeNode = sideTree.activeId ? findChild(sideTree.groups, sideTree.activeId) : null
  const activePage =
    activeNode?.type === SIDE_TREE_NODE_TYPE.PAGE && activeNode.docId ? activeNode : null
  const treeChanges = hasTreeChanges(sideTree)
  const nodeChanges = hasNodeChanges(sideTree)
  const hasScopeItems = runtime.publishCount > 0
  const scopeSaysClean = runtime.scopeLoaded && !hasScopeItems
  const isDirty = saveStatus === 'dirty'
  const isSaving = saveStatus === 'saving'
  const showActions =
    (!scopeSaysClean && (treeChanges || nodeChanges)) ||
    hasScopeItems ||
    isDirty ||
    isSaving ||
    runtime.isPublishing

  // Keep command availability separate from visibility:
  // - publishing keeps the button visible but blocks duplicate publish mutations.
  // - saving keeps the button visible but avoids racing save and publish writes.
  // - a freshly loaded empty publish scope means the server sees nothing to publish;
  //   this wins over stale SideTree node state until the tree reload catches up.
  // - if there are no selectable scope items, no tree/node changes, and no dirty editor,
  //   there is nothing actionable even if the shell is still mounted for animation.
  const publishDisabled =
    runtime.isPublishing ||
    isSaving ||
    (!runtime.hasSelectableScopeItems &&
      (scopeSaysClean || (!treeChanges && !nodeChanges)) &&
      !isDirty)

  const optionsDisabled = runtime.isPublishing || isSaving || !runtime.scopeLoaded || !hasScopeItems

  return {
    activeNodeId: activeNode?.id ?? null,
    activeDocId: activePage?.docId ?? null,
    hasTreeChanges: treeChanges,
    hasScopeItems,
    isDirty,
    isSaving,
    isPublishing: runtime.isPublishing,
    showActions,
    publishDisabled,
    optionsDisabled,
    publishCount: runtime.publishCount,
    scopeStatus: !runtime.scopeLoaded ? 'checking' : hasScopeItems ? 'pending' : 'none',
  }
}

export default function DocsEditorStore(init: TInit): TStore {
  // Docs editor actions are split across the tree, article, snackbar, and future drawers.
  // Keep cross-region session commands here so toolbar actions do not reach into SideTree props.
  let sideTree = init.sideTree
  const publishRuntime: TDocPublishRuntime = { ...DEFAULT_PUBLISH_RUNTIME }
  let saveDocDraftHandler: (() => Promise<void>) | null = null
  let store: TStore
  const activeChild = sideTree.activeId ? findChild(sideTree.groups, sideTree.activeId) : null
  const activePage =
    activeChild?.type === SIDE_TREE_NODE_TYPE.PAGE && activeChild.docId ? activeChild : null
  const initialArticleSession =
    activePage && String(init.article?.docId) === String(activePage.docId)
      ? resolveDraftSession(init.article, activePage)
      : null
  const initialSaveStatus: TDocSaveStatus = initialArticleSession ? 'saved' : 'idle'

  const refreshPublishView = (): void => {
    store.publishView = buildPublishView(sideTree, store.saveStatus, publishRuntime)
  }

  const initialStore: TStore = {
    baselineValue: initialArticleSession?.body ?? EMPTY_EDITOR_VALUE,
    bodyValue: initialArticleSession?.body ?? EMPTY_EDITOR_VALUE,
    docDraftInfo: initialArticleSession?.info ?? EMPTY_DOC_DRAFT_INFO,
    mode: DOC_EDITOR_MODE.EDIT,
    publishView: buildPublishView(sideTree, initialSaveStatus, publishRuntime),
    revisionReloadKey: 0,
    saveError: null,
    saveStatus: initialSaveStatus,

    addGroup: (): void => {
      sideTree.addGroup()
    },

    attachSideTree: (nextSideTree): void => {
      sideTree = nextSideTree
      refreshPublishView()
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

    setPublishRuntime: (patch): void => {
      Object.assign(publishRuntime, patch)
      refreshPublishView()
    },

    setDocDraftSession: (patch): void => {
      Object.assign(store, patch)
      refreshPublishView()
    },
  }

  store = proxy(initialStore)
  return store
}
