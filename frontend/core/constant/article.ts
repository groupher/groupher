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

export const DOC_SNAPSHOT_ACTION = {
  CHECKPOINT: 'checkpoint',
  PUBLISH: 'publish',
  FORK: 'fork',
  PROMOTE: 'promote',
  RESTORE: 'restore',
} as const

export type TArticleStage = (typeof ARTICLE_STAGE)[keyof typeof ARTICLE_STAGE]
export type TDocBranchType = (typeof DOC_BRANCH_TYPE)[keyof typeof DOC_BRANCH_TYPE]
export type TDocBranchStatus = (typeof DOC_BRANCH_STATUS)[keyof typeof DOC_BRANCH_STATUS]
export type TDocSnapshotAction = (typeof DOC_SNAPSHOT_ACTION)[keyof typeof DOC_SNAPSHOT_ACTION]

/** GraphQL serializes Absinthe enum values as uppercase wire strings. */
export type TDocSnapshotStageWire = Uppercase<TArticleStage>
export type TDocSnapshotActionWire = Uppercase<TDocSnapshotAction>
