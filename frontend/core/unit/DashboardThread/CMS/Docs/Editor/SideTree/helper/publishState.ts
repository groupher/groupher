import { DOC_STAGE } from '~/const/dsb/docs'

import type { TDocTreeNodePublishState } from '../spec'

export const DOC_PUBLISH_STATUS = {
  DRAFT: DOC_STAGE.DRAFT,
  PUBLIC: DOC_STAGE.PUBLIC,
} as const

type TDocPublishStatus = (typeof DOC_PUBLISH_STATUS)[keyof typeof DOC_PUBLISH_STATUS]

/**
 * Normalize the publish state while the API still exposes the legacy boolean.
 */
export const getDocPublishStatus = (state?: TDocTreeNodePublishState | null): TDocPublishStatus => {
  if (state?.hasDraft === true) return DOC_PUBLISH_STATUS.DRAFT
  if (state?.status === DOC_PUBLISH_STATUS.PUBLIC) return DOC_PUBLISH_STATUS.PUBLIC
  if (state?.status === DOC_PUBLISH_STATUS.DRAFT) return DOC_PUBLISH_STATUS.DRAFT

  return DOC_PUBLISH_STATUS.PUBLIC
}

/**
 * The page dot only represents article-content draft state. Tree structure
 * changes are shown by the SideTree footer instead.
 */
export const needsPublishAttention = (state?: TDocTreeNodePublishState | null): boolean => {
  return state?.hasDraft === true || state?.hasUnpublishedChanges === true
}

export const isPublicDoc = (state?: TDocTreeNodePublishState | null): boolean =>
  getDocPublishStatus(state) === DOC_PUBLISH_STATUS.PUBLIC
