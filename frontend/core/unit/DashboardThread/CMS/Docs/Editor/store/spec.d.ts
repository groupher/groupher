import type { TRichEditorValue } from '@groupher/rich-editor'

import type { TArticleStage } from '~/const/article'

import type { TDocDraftInitialData } from '../Article/spec'
import type { TDocEditorMode } from '../constant'
import type { TDocTreeNodePublishState, TSideTreeController } from '../SideTree/spec'

export type TDocSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type TDocPublishChecklistStatus = 'checking' | 'pending' | 'none'
export type TDocActionSnackbarMode = 'hidden' | 'article' | 'tree'

export type TDocPublishRuntime = {
  isPublishing: boolean
  checklistLoaded: boolean
  publishCount: number
  hasSelectableChecklistItems: boolean
}

export type TDocPublishView = {
  activeNodeId: string | null
  activeDocId: string | null
  surfaceMode: TDocActionSnackbarMode
  hasTreeChanges: boolean
  hasChecklistItems: boolean
  isDirty: boolean
  isSaving: boolean
  isPublishing: boolean
  showActions: boolean
  publishDisabled: boolean
  optionsDisabled: boolean
  publishCount: number
  checklistStatus: TDocPublishChecklistStatus
}

export type TDocDraftAuthor = {
  login?: string | null
  nickname?: string | null
  avatar?: string | null
}

export type TDocDraftInfo = {
  id: string
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

export type TInit = {
  sideTree: TSideTreeController
  article?: TDocDraftInitialData | null
}

export type TStore = {
  baselineValue: TRichEditorValue
  bodyValue: TRichEditorValue
  docDraftInfo: TDocDraftInfo
  mode: TDocEditorMode
  publishRuntime: TDocPublishRuntime
  publishView: TDocPublishView
  revisionReloadKey: number
  saveError: string | null
  saveStatus: TDocSaveStatus
  addGroup: () => void
  attachSideTree: (sideTree: TSideTreeController) => void
  attachSaveDocDraft: (handler: (() => Promise<void>) | null) => void
  reloadDocDraft: () => void
  reloadSideTree: () => void
  saveDocDraft: () => Promise<void>
  setMode: (mode: TDocEditorMode) => void
  setPublishRuntime: (patch: Partial<TDocPublishRuntime>) => void
  setDocDraftSession: (
    patch: Partial<
      Pick<TStore, 'baselineValue' | 'bodyValue' | 'docDraftInfo' | 'saveError' | 'saveStatus'>
    >,
  ) => void
}
