export const TITLE_STAGE_VIEW = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const

export type TTitleStageView = (typeof TITLE_STAGE_VIEW)[keyof typeof TITLE_STAGE_VIEW]

export const TITLE_STAGE_PUBLISHED_VISIBLE_MS = 2000
