/** Shared Article lifecycle values. Keep these aligned with CMS.Const and GraphQL enums. */
export const ARTICLE_STAGE = {
  DRAFT: 'draft',
  PUBLIC: 'public',
} as const

export const ARTICLE_BRANCH_TYPE = {
  MAIN: 'main',
  PREVIEW: 'preview',
} as const

export const ARTICLE_BRANCH_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const

export const ARTICLE_SNAPSHOT_ACTION = {
  CHECKPOINT: 'checkpoint',
  PUBLISH: 'publish',
  FORK: 'fork',
  PROMOTE: 'promote',
  RESTORE: 'restore',
} as const

export type TArticleStage = (typeof ARTICLE_STAGE)[keyof typeof ARTICLE_STAGE]
export type TArticleBranchType = (typeof ARTICLE_BRANCH_TYPE)[keyof typeof ARTICLE_BRANCH_TYPE]
export type TArticleBranchStatus =
  (typeof ARTICLE_BRANCH_STATUS)[keyof typeof ARTICLE_BRANCH_STATUS]
export type TArticleSnapshotAction =
  (typeof ARTICLE_SNAPSHOT_ACTION)[keyof typeof ARTICLE_SNAPSHOT_ACTION]

/** GraphQL serializes Absinthe enum values as uppercase wire strings. */
export type TArticleSnapshotStageWire = Uppercase<TArticleStage>
export type TArticleSnapshotActionWire = Uppercase<TArticleSnapshotAction>
