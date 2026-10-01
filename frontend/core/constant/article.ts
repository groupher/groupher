/** Shared Article lifecycle values. Keep these aligned with CMS.Const and GraphQL enums. */
export const ARTICLE_STAGE = {
  DRAFT: 'draft',
  PUBLIC: 'public',
} as const

export const DOC_BRANCH_TYPE = {
  MAIN: 'main',
  PREVIEW: 'preview',
} as const

export const DOC_BRANCH_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const

export type TArticleStage = (typeof ARTICLE_STAGE)[keyof typeof ARTICLE_STAGE]
export type TDocBranchType = (typeof DOC_BRANCH_TYPE)[keyof typeof DOC_BRANCH_TYPE]
export type TDocBranchStatus = (typeof DOC_BRANCH_STATUS)[keyof typeof DOC_BRANCH_STATUS]
