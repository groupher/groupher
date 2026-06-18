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
  docDraftInfo: TDocDraftInfo
  saveError: string | null
  saveStatus: TDocSaveStatus
  addGroup: () => void
  attachSideTree: (sideTree: TSideTreeController) => void
  attachSaveDocDraft: (handler: (() => Promise<void>) | null) => void
  saveDocDraft: () => Promise<void>
  setDocDraftSession: (
    patch: Partial<Pick<TStore, 'docDraftInfo' | 'saveError' | 'saveStatus'>>,
  ) => void
}
