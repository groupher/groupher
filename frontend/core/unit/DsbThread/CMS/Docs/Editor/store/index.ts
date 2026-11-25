import { proxy } from 'valtio'

import {
  composeEditorDraft,
  composeEditorDraftFromSession,
  composeEditorDraftMeta,
  composeDocDraftInfo,
  composeEmptyEditorDraft,
  composeEmptySavedDraft,
  composeSavedDraft,
  countEditorText,
  isDraftDirty,
} from '../Article/helper'
import type { TEditorDraft } from '../Article/spec'
import { DOC_EDITOR_MODE } from '../constant'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import { findChild, needsPublishAttention } from '../SideTree/helper'
import type { TDocTreeNodePublishState, TSideTreeController } from '../SideTree/spec'
import type {
  TApplySavedParams,
  TDocDraftInfo,
  TDocPublishRuntime,
  TDocPublishView,
  TDocSaveStatus,
  TInit,
  TStore,
} from './spec'

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

/** Creates the Docs Editor store that owns a single document editing session. */
export default function createDocsEditorStore(_init: TInit = {}): TStore {
  const store = proxy<TStore>({
    workingCopyId: null,
    publicSnapshotId: null,
    draft: composeEmptyEditorDraft(),
    savedDraft: composeEmptySavedDraft(),
    draftSource: 'public',
    meta: composeEditorDraftMeta(),
    loadStatus: { error: null, loadedDocId: null, loading: false },
    draftSaveStatus: { error: null, lastSavedAt: null, saving: false },
    mode: DOC_EDITOR_MODE.EDIT,
    publishRuntime: { ...DEFAULT_PUBLISH_RUNTIME },
    revisionReloadKey: 0,

    applyDraftPatch: (patch): void => {
      store.meta = composeEditorDraftMeta({ ...store.meta, ...patch })
      store.draftSaveStatus = { ...store.draftSaveStatus, error: null, saving: false }
    },

    applyLoaded: (session): void => {
      const nextDraft = composeEditorDraftFromSession(session)
      store.workingCopyId = session.workingCopyId ?? null
      store.publicSnapshotId = session.publicSnapshotId ?? null
      store.draft = nextDraft
      store.savedDraft = composeSavedDraft(nextDraft, {
        workingCopyId: session.workingCopyId,
        publicSnapshotId: session.publicSnapshotId,
      })
      store.draftSource = session.source
      store.meta = composeEditorDraftMeta(session.info)
      store.loadStatus = { error: null, loadedDocId: nextDraft.docId || null, loading: false }
      store.draftSaveStatus = { error: null, lastSavedAt: null, saving: false }
    },

    reconcileConflict: (session): void => {
      const canonical = composeEditorDraftFromSession(session)
      store.savedDraft = composeSavedDraft(canonical, {
        workingCopyId: session.workingCopyId,
        publicSnapshotId: session.publicSnapshotId,
      })
      store.draft = composeEditorDraft({ ...store.draft, version: session.version })
      store.draftSource = session.source
      store.meta = composeEditorDraftMeta(session.info)
      store.draftSaveStatus = {
        error: 'The server draft changed. Your local edits were preserved for reconciliation.',
        lastSavedAt: null,
        saving: false,
      }
    },

    applySaved: ({ meta, requestDraft, savedDraft, startedDraft }: TApplySavedParams): void => {
      const persistedDraft = composeEditorDraft({
        ...requestDraft,
        version: savedDraft.revision,
      })
      store.workingCopyId = savedDraft.id
      store.savedDraft = composeSavedDraft(persistedDraft, { workingCopyId: savedDraft.id })
      store.draftSource = 'draft'
      store.meta = meta

      const current = store.draft
      store.draft = composeEditorDraft({
        bodyValue:
          current.bodyJson === startedDraft.bodyJson ? requestDraft.bodyValue : current.bodyValue,
        docId: current.docId || savedDraft.articleId || requestDraft.docId,
        slug: current.slug === startedDraft.slug ? requestDraft.slug : current.slug,
        subtitle:
          current.subtitle === startedDraft.subtitle ? requestDraft.subtitle : current.subtitle,
        title: current.title === startedDraft.title ? requestDraft.title : current.title,
        version: persistedDraft.version,
      })
      store.draftSaveStatus = { error: null, lastSavedAt: Date.now(), saving: false }
    },

    clearSaveError: (): void => {
      store.draftSaveStatus = { ...store.draftSaveStatus, error: null }
    },

    editBodyValue: (bodyValue): void => updateDraft({ bodyValue }),
    editSubtitle: (subtitle): void => updateDraft({ subtitle }),
    editTitle: (title): void => updateDraft({ title }),

    resetDraft: (): void => {
      store.workingCopyId = null
      store.publicSnapshotId = null
      store.draft = composeEmptyEditorDraft()
      store.savedDraft = composeEmptySavedDraft()
      store.draftSource = 'public'
      store.meta = composeEditorDraftMeta()
      store.loadStatus = { error: null, loadedDocId: null, loading: false }
      store.draftSaveStatus = { error: null, lastSavedAt: null, saving: false }
    },

    setDraftSlug: (slug): void => updateDraft({ slug }),
    setLoadError: (error): void => {
      store.loadStatus = { ...store.loadStatus, error, loading: false }
    },
    setLoading: (): void => {
      store.loadStatus = { ...store.loadStatus, error: null, loading: true }
      store.draftSaveStatus = { ...store.draftSaveStatus, error: null }
    },
    setSaveError: (error): void => {
      store.draftSaveStatus = { ...store.draftSaveStatus, error, saving: false }
    },
    setSaving: (): void => {
      store.draftSaveStatus = { ...store.draftSaveStatus, error: null, saving: true }
    },
    reloadDocDraft: (): void => {
      store.revisionReloadKey += 1
    },
    setMode: (mode): void => {
      store.mode = mode
    },
    setPublishRuntime: (patch): void => {
      Object.assign(store.publishRuntime, patch)
    },
  })

  function updateDraft(patch: Partial<Omit<TEditorDraft, 'bodyJson'>>): void {
    store.draft = composeEditorDraft({ ...store.draft, ...patch })
  }

  return store
}

/** Derives the save indicator state from the authoritative editor draft. */
export const deriveDocSaveStatus = (
  draft: TStore['draft'],
  savedDraft: TStore['savedDraft'],
  loadStatus: TStore['loadStatus'],
  draftSaveStatus: TStore['draftSaveStatus'],
): TDocSaveStatus => {
  if (!draft.docId) return 'idle'
  if (draftSaveStatus.saving) return 'saving'
  if (!isDraftDirty(draft, savedDraft) && (loadStatus.error || draftSaveStatus.error))
    return 'error'
  if (isDraftDirty(draft, savedDraft)) return 'dirty'
  return 'saved'
}

/** Derives the cross-region Doc information from its current editor session. */
export const deriveDocDraftInfo = (
  store: Pick<TStore, 'draft' | 'meta' | 'workingCopyId'>,
  publishState: TDocTreeNodePublishState | null,
): TDocDraftInfo => {
  return composeDocDraftInfo({
    bodyStats: countEditorText(store.draft.bodyValue),
    draft: store.draft,
    meta: store.meta,
    publishState,
    workingCopyId: store.workingCopyId,
  })
}
