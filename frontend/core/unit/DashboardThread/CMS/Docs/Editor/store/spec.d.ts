import type { TRichEditorValue } from '@groupher/rich-editor'

import type { TSideTreeController } from '../SideTree/useSideTree'

export type TDocSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type TDocDraftAuthor = {
  login?: string | null
  nickname?: string | null
  avatar?: string | null
}

export type TDocDraftInfo = {
  id: string
  title: string
  slug: string
  insertedAt: string | null
  updatedAt: string | null
  author: TDocDraftAuthor | null
  wordCount: number
  characterCount: number
}

export type TInit = {
  sideTree: TSideTreeController
}

export type TStore = {
  baselineValue: TRichEditorValue
  bodyValue: TRichEditorValue
  docDraftInfo: TDocDraftInfo
  revisionReloadKey: number
  saveError: string | null
  saveStatus: TDocSaveStatus
  addGroup: () => void
  attachSideTree: (sideTree: TSideTreeController) => void
  attachSaveDocDraft: (handler: (() => Promise<void>) | null) => void
  reloadDocDraft: () => void
  saveDocDraft: () => Promise<void>
  setDocDraftSession: (
    patch: Partial<
      Pick<TStore, 'baselineValue' | 'bodyValue' | 'docDraftInfo' | 'saveError' | 'saveStatus'>
    >,
  ) => void
}
