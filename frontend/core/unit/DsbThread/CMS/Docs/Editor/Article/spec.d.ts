import type { TRichEditorValue } from '@groupher/rich-editor'

import type { TArticleStage } from '~/const/article'
import type { TLocalDraftServerBase } from '~/lib/localDraftHistory/types'

import type { TDocTreeNodePublishState } from '../SideTree/spec'
import type { TDocDraftInfo } from '../store/spec'

export type TDocWorkingCopy = {
  id: string
  articleId: string
  scopeType: string
  revision: number
  title: string
  slug?: string | null
  bodyJson: string
  threadFields?: { subtitle?: string | null } | null
  insertedAt?: string | null
  updatedAt?: string | null
}

export type TEditorDraft = {
  docId: string
  version: number
  title: string
  subtitle: string
  slug: string
  bodyValue: TRichEditorValue
  bodyJson: string
}

export type TSavedDraft = {
  docId: string
  version: number
  title: string
  subtitle: string
  bodyValue: TRichEditorValue
  bodyJson: string
  revisionSignature: string
  base: TLocalDraftServerBase
}

export type TDocDraftSource = 'draft' | 'public'

export type TEditorDraftMeta = {
  stage?: TArticleStage | null
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
  workingCopyId?: string | null
  bodyStats: Pick<TDocDraftInfo, 'characterCount' | 'wordCount'>
  draft: TEditorDraft
  meta: TEditorDraftMeta
  publishState?: TDocTreeNodePublishState | null
  saveError: string | null
  savedDraft: TSavedDraft
  saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
}

export type TDocDraftSession = {
  workingCopyId?: string | null
  publicSnapshotId?: string | null
  body: TRichEditorValue
  bodyJson: string
  info: TDocDraftInfo
  source: TDocDraftSource
  version: number
  slug: string
  subtitle: string
  title: string
}

export type TDocEditorSource = {
  workingCopy: TDocWorkingCopy | null
  publicSnapshot: Omit<TDocWorkingCopy, 'scopeType' | 'revision'> | null
}
