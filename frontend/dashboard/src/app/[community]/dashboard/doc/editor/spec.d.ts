import type { TDocDraftInitialData } from '~/unit/DashboardThread/CMS/Docs/Editor/Article/spec'
import type { TDocTreeInitialData } from '~/unit/DashboardThread/CMS/Docs/Editor/SideTree/spec'

export type TGraphQLResult<TData> = {
  data?: TData
  errors?: unknown
}

export type TDocTreeQueryData = {
  docTree?: TDocTreeInitialData | null
}

export type TDocDraftQueryData = {
  docDraft?: TDocDraftInitialData | null
}

export type TDocEditorInitialDataResult = {
  docTree?: TDocTreeInitialData | null
  docDraft?: TDocDraftInitialData | null
  activeDocId: string | null
}
