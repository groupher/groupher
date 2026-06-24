export { DEFAULT_GROUP_MARKER, DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER } from '~/const/marker'

export const DOC_COVER_VIEW = {
  PUBLIC: 'PUBLIC',
  DASHBOARD: 'DASHBOARD',
} as const

export type TDocCoverView = (typeof DOC_COVER_VIEW)[keyof typeof DOC_COVER_VIEW]

export const DOC_COVER_NODE_TYPE = {
  PAGE: 'page',
  LINK: 'link',
} as const
