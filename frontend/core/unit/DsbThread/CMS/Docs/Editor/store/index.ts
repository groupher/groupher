import { proxy } from 'valtio'

import { EMPTY_EDITOR_VALUE } from '../Article/constant'
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
  queueLoaded: false,
  publishCount: 0,
  queueHasItems: false,
}

/** Reports whether tree changes at the frontend shared boundary. */
export const hasTreeChanges = (sideTree: TSideTreeController): boolean => {
  return (
    sideTree.treeState?.hasUnpublishedChanges === true ||
    (sideTree.treeState?.stagedEventCount ?? 0) > 0 ||
    sideTree.pins.some((pin) => needsPublishAttention(pin.publishState)) ||
    sideTree.groups.some((group) => needsPublishAttention(group.publishState))
  )
}

const hasNodeChanges = (sideTree: TSideTreeController): boolean => {
  return sideTree.groups.some((group) =>
    group.pages.some((child) => needsPublishAttention(child.publishState)),
  )
}

/** Builds publish view from typed frontend shared inputs. */
export const buildPublishView = (
  sideTree: TSideTreeController | null,
  saveStatus: TDocSaveStatus,
  runtime: TDocPublishRuntime,
): TDocPublishView => {
  if (!sideTree) {
    return {
      activeNodeId: null,
      activeDocId: null,
      surfaceMode: 'hidden',
      hasTreeChanges: false,
      hasQueueItems: false,
      isDirty: saveStatus === 'dirty',
      isSaving: saveStatus === 'saving',
      isPublishing: runtime.isPublishing,
      showActions: false,
      publishDisabled: true,
      optionsDisabled: true,
      publishCount: 0,
      queueStatus: 'checking',
    }
  }

  const activeNode = sideTree.activeId ? findChild(sideTree.groups, sideTree.activeId) : null
  const activePage =
    activeNode?.type === SIDE_TREE_NODE_TYPE.PAGE && activeNode.docId ? activeNode : null
  const treeChanges = hasTreeChanges(sideTree)
  const nodeChanges = hasNodeChanges(sideTree)
  const hasQueueItems = runtime.publishCount > 0
  const queueSaysClean = runtime.queueLoaded && !hasQueueItems
  const isDirty = saveStatus === 'dirty'
  const isSaving = saveStatus === 'saving'
  const hasPendingQueue =
    runtime.queueLoaded && runtime.queueHasItems && (treeChanges || nodeChanges || hasQueueItems)
  const activePageNeedsPublish = needsPublishAttention(activePage?.publishState)
  const surfaceMode = activePage
    ? 'article'
    : treeChanges || nodeChanges || hasQueueItems || runtime.isPublishing
      ? 'tree'
      : 'hidden'
  const showActions =
    treeChanges ||
    hasPendingQueue ||
    activePageNeedsPublish ||
    isDirty ||
    isSaving ||
    runtime.isPublishing

  // Keep command availability separate from visibility:
  // - publishing keeps the button visible but blocks duplicate publish mutations.
  // - saving keeps publish disabled until the backend has a durable draft/checklist.
  // - a freshly loaded empty publish checklist means the server sees nothing to publish;
  //   this wins over stale SideTree node state until the tree reload catches up.
  // - if there are no selectable checklist items, no tree/node changes, and no dirty editor,
  //   there is nothing actionable even if the shell is still mounted for animation.
  const publishDisabled =
    runtime.isPublishing ||
    isSaving ||
    isDirty ||
    !hasPendingQueue ||
    (!runtime.queueHasItems && (queueSaysClean || (!treeChanges && !nodeChanges)) && !isDirty)

  const optionsDisabled = runtime.isPublishing || isSaving || !runtime.queueLoaded || !hasQueueItems

  return {
    activeNodeId: activeNode?.id ?? null,
    activeDocId: activePage?.docId ?? null,
    surfaceMode,
    hasTreeChanges: treeChanges,
    hasQueueItems,
    isDirty,
    isSaving,
    isPublishing: runtime.isPublishing,
    showActions,
    publishDisabled,
    optionsDisabled,
    publishCount: runtime.publishCount,
    queueStatus: !runtime.queueLoaded ? 'checking' : hasQueueItems ? 'pending' : 'none',
  }
}

/** Creates the Docs Editor store that coordinates draft sessions, SideTree actions, and publishing. */
export default function createDocsEditorStore(init: TInit = {}): TStore {
  // Docs editor actions are split across the tree, article, snackbar, and future drawers.
  // Keep cross-region session commands here so toolbar actions do not reach into SideTree props.
  let sideTree = init.sideTree ?? null
  let saveDocDraftHandler: (() => Promise<void>) | null = null
  let store: TStore
  const initialSaveStatus: TDocSaveStatus = 'idle'

  const currentSideTree = (): TSideTreeController => {
    if (!sideTree) throw new Error('DocsEditor side tree is not attached')
    return sideTree
  }

  const refreshPublishView = (): void => {
    const nextPublishView = buildPublishView(sideTree, store.saveStatus, store.publishRuntime)
    const currentPublishView = store.publishView
    const isUnchanged = Object.keys(nextPublishView).every(
      (key) =>
        nextPublishView[key as keyof TDocPublishView] ===
        currentPublishView[key as keyof TDocPublishView],
    )

    if (!isUnchanged) store.publishView = nextPublishView
  }

  const initialStore: TStore = {
    baselineValue: EMPTY_EDITOR_VALUE,
    bodyValue: EMPTY_EDITOR_VALUE,
    docDraftInfo: EMPTY_DOC_DRAFT_INFO,
    mode: DOC_EDITOR_MODE.EDIT,
    publishRuntime: { ...DEFAULT_PUBLISH_RUNTIME },
    publishView: buildPublishView(sideTree, initialSaveStatus, DEFAULT_PUBLISH_RUNTIME),
    revisionReloadKey: 0,
    saveError: null,
    saveStatus: initialSaveStatus,

    addGroup: (): void => {
      currentSideTree().addGroup()
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
      currentSideTree().reload()
    },

    saveDocDraft: async (): Promise<void> => {
      await saveDocDraftHandler?.()
    },

    setMode: (mode): void => {
      store.mode = mode
    },

    setPublishRuntime: (patch): void => {
      Object.assign(store.publishRuntime, patch)
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
