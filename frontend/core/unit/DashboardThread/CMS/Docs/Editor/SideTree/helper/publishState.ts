import type { TDocTreeNodePublishState } from '../spec'

export const DOC_PUBLISH_STATUS = {
  DRAFT: 'draft',
  PUBLIC: 'public',
} as const

type TDocPublishStatus = (typeof DOC_PUBLISH_STATUS)[keyof typeof DOC_PUBLISH_STATUS]

/**
 * Normalize the publish state while the API still exposes the legacy boolean.
 */
export const getDocPublishStatus = (state?: TDocTreeNodePublishState | null): TDocPublishStatus => {
  if (state?.status === DOC_PUBLISH_STATUS.PUBLIC) return DOC_PUBLISH_STATUS.PUBLIC
  if (state?.status === DOC_PUBLISH_STATUS.DRAFT) return DOC_PUBLISH_STATUS.DRAFT

  return state?.published ? DOC_PUBLISH_STATUS.PUBLIC : DOC_PUBLISH_STATUS.DRAFT
}

/**
 * The side-tree dot means the public docs do not match the current draft.
 */
export const needsPublishAttention = (state?: TDocTreeNodePublishState | null): boolean => {
  const status = getDocPublishStatus(state)

  return status === DOC_PUBLISH_STATUS.DRAFT || state?.hasUnpublishedChanges === true
}

export const isPublicDoc = (state?: TDocTreeNodePublishState | null): boolean =>
  getDocPublishStatus(state) === DOC_PUBLISH_STATUS.PUBLIC
