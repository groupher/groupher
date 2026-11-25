import type { TRichEditorValue } from '@groupher/rich-editor'

import type { TArticleStage } from '~/const/article'

import type {
  TDocDraftSession,
  TDocDraftSource,
  TEditorDraft,
  TEditorDraftMeta,
  TSavedDraft,
  TDraftLoadStatus,
  TDraftSaveStatus,
} from '../Article/spec'
import type { TDocTreeNodePublishState, TSideTreeController } from '../SideTree/spec'
import type { TDocEditorMode } from '../spec'

export type TDocPublishQueueStatus = 'checking' | 'pending' | 'none'
export type TDocActionSnackbarMode = 'hidden' | 'article' | 'tree'
export type TDocSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type TDocPublishRuntime = {
  isPublishing: boolean
  queueLoaded: boolean
  publishCount: number
  queueHasItems: boolean
}

export type TDocPublishView = {
  activeNodeId: string | null
  activeDocId: string | null
  surfaceMode: TDocActionSnackbarMode
  hasTreeChanges: boolean
  hasQueueItems: boolean
  isDirty: boolean
  isSaving: boolean
  isPublishing: boolean
  showActions: boolean
  publishDisabled: boolean
  optionsDisabled: boolean
  publishCount: number
  queueStatus: TDocPublishQueueStatus
}

export type TDocDraftAuthor = {
  login?: string | null
  nickname?: string | null
  avatar?: string | null
}

export type TDocDraftInfo = {
  id: string
  workingCopyId?: string | null
  workingCopyRevision?: number
  title: string
  subtitle: string
  slug: string
  stage?: TArticleStage | null
  insertedAt: string | null
  updatedAt: string | null
  author: TDocDraftAuthor | null
  publishState?: TDocTreeNodePublishState | null
  wordCount: number
  characterCount: number
}

export type TApplySavedParams = {
  meta: TEditorDraftMeta
  requestDraft: TEditorDraft
  savedDraft: {
    id: string
    articleId: string
    revision: number
    insertedAt?: string | null
    updatedAt?: string | null
    slug?: string | null
  }
  startedDraft: TEditorDraft
}

export type TInit = Record<string, never>

export type TStore = {
  workingCopyId: string | null
  publicSnapshotId: string | null
  draft: TEditorDraft
  savedDraft: TSavedDraft
  draftSource: TDocDraftSource
  meta: TEditorDraftMeta
  loadStatus: TDraftLoadStatus
  draftSaveStatus: TDraftSaveStatus
  mode: TDocEditorMode
  publishRuntime: TDocPublishRuntime
  revisionReloadKey: number
  applyDraftPatch: (patch: Partial<TEditorDraftMeta>) => void
  applyLoaded: (session: TDocDraftSession) => void
  reconcileConflict: (session: TDocDraftSession) => void
  applySaved: (params: TApplySavedParams) => void
  clearSaveError: () => void
  editBodyValue: (value: TRichEditorValue) => void
  editSubtitle: (value: string) => void
  editTitle: (value: string) => void
  resetDraft: () => void
  setDraftSlug: (slug: string) => void
  setLoadError: (error: string) => void
  setLoading: () => void
  setSaveError: (error: string) => void
  setSaving: () => void
  reloadDocDraft: () => void
  setMode: (mode: TDocEditorMode) => void
  setPublishRuntime: (patch: Partial<TDocPublishRuntime>) => void
}

export type TDocsEditorCommandValue = {
  sideTree: TSideTreeController
  addGroup: () => void
  reloadSideTree: () => void
  saveDocDraft: () => Promise<void>
  registerSaveDocDraft: (handler: () => Promise<void>) => () => void
}
