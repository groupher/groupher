import type { TRichEditorValue } from '@groupher/rich-editor'

import type { TDocDraftInfo } from '../store/spec'

export type TDocDraftDTO = {
  id: string
  title?: string | null
  slug?: string | null
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

export type TDocDraftSession = {
  body: TRichEditorValue
  bodyJson: string
  info: TDocDraftInfo
  slug: string
  title: string
}
