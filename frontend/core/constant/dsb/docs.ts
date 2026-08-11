import type { TArticleStage } from '../article'

// The recursive selector counts the current node as depth 0. A value of 2
// therefore allows three visible levels: root, child, and grandchild.
/** The public and Dashboard tree documents intentionally expose three levels. */
export const DOC_TREE_MAX_VISIBLE_LEVELS = 3

export const DSB_DOC_EVENT = {
  ADD_TAB: 'DSB_DOC_ADD_TAB',
  PUBLISH_CHECKLIST_RELOAD: 'DSB_DOC_PUBLISH_CHECKLIST_RELOAD',
  DRAFT_PATCH: 'DSB_DOC_DRAFT_PATCH',
  REVISION_RELOAD: 'DSB_DOC_REVISION_RELOAD',
  PUBLISH_SUCCESS: 'DSB_DOC_PUBLISH_SUCCESS',
} as const

export type TDocDraftPatchPayload = {
  docId?: string | null
  stage?: TArticleStage | null
}

export type TDocPublishSuccessPayload = {
  docIds: string[]
}
