export const DOC_STAGE = {
  DRAFT: 'draft',
  PUBLIC: 'public',
} as const

export type TDocStage = (typeof DOC_STAGE)[keyof typeof DOC_STAGE]

export const DSB_DOC_EVENT = {
  ADD_TAB: 'DSB_DOC_ADD_TAB',
  PUBLISH_CHECKLIST_RELOAD: 'DSB_DOC_PUBLISH_CHECKLIST_RELOAD',
  DRAFT_PATCH: 'DSB_DOC_DRAFT_PATCH',
  REVISION_RELOAD: 'DSB_DOC_REVISION_RELOAD',
  PUBLISH_SUCCESS: 'DSB_DOC_PUBLISH_SUCCESS',
} as const

export type TDocDraftPatchPayload = {
  docId?: string | null
  stage?: TDocStage | null
}

export type TDocPublishSuccessPayload = {
  docIds: string[]
}
