import type { TRichEditorValue } from '@groupher/rich-editor'

import type { TDocStage } from '~/const/dsb/docs'

import type { TDocTreeNodePublishState } from '../SideTree/spec'
import type { TDocDraftInfo } from '../store/spec'

export type TDocDraftDTO = {
  id: string
  docId?: string | null
  title?: string | null
  subtitle?: string | null
  slug?: string | null
  stage?: TDocStage | null
  digest?: string | null
  insertedAt?: string | null
  updatedAt?: string | null
  author?: {
    login?: string | null
    nickname?: string | null
    avatar?: string | null
  } | null
  document?: {
    json?: string | null
  } | null
}

export type TDocDraftInitialData = TDocDraftDTO

export type TEditorDraft = {
  docId: string
  title: string
  subtitle: string
  slug: string
  bodyValue: TRichEditorValue
  bodyJson: string
}

export type TSavedDraft = {
  docId: string
  title: string
  subtitle: string
  bodyValue: TRichEditorValue
  bodyJson: string
  revisionSignature: string
}

export type TDocDraftSource = 'draft' | 'public'

export type TEditorDraftMeta = {
  stage?: TDocStage | null
  insertedAt: string | null
  updatedAt: string | null
  author: TDocDraftInfo['author']
}

export type TDraftLoadStatus = {
  loadedDocId: string | null
  loading: boolean
  error: string | null
}

export type TDraftSaveStatus = {
  saving: boolean
  error: string | null
  lastSavedAt: number | null
}

export type TDraftSnapshotStatus = {
  creating: boolean
  lastCreatedSignature: string
}

export type TEditorDraftStorePatchInput = {
  bodyStats: Pick<TDocDraftInfo, 'characterCount' | 'wordCount'>
  draft: TEditorDraft
  meta: TEditorDraftMeta
  publishState?: TDocTreeNodePublishState | null
  saveError: string | null
  savedDraft: TSavedDraft
  saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
}

export type TDocDraftSession = {
  body: TRichEditorValue
  bodyJson: string
  info: TDocDraftInfo
  source: TDocDraftSource
  slug: string
  subtitle: string
  title: string
}
