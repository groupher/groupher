import type { TArticleCat, TArticleState, TArticleOrder, TArticleCatMode } from '~/spec'

export const ARTICLE_CAT_REJECT = {
  REJECT: 'REJECT', // 关闭
  REJECT_DUP: 'REJECT_DUP', // 重复问题
  REJECT_NO_PLAN: 'REJECT_NO_PLAN', // 无计划
  REJECT_REPRO: 'REJECT_REPRO', // 无法重现
  REJECT_STALE: 'REJECT_STALE', // 已过时
}

export const ARTICLE_ORDER = {
  UPVOTES: 'UPVOTES',
  COMMENTS: 'COMMENTS',
  PUBLISH: 'PUBLISH',
  VIEWS: 'VIEWS',
} as Record<Uppercase<TArticleOrder>, Uppercase<TArticleOrder>>

export const ARTICLE_CAT = {
  FEATURE: 'FEATURE',
  BUG: 'BUG',
  QUESTION: 'QUESTION',
  OTHER: 'OTHER',
} as Record<Uppercase<TArticleCat>, Uppercase<TArticleCat>>

export const ARTICLE_STATE = {
  TODO: 'TODO',
  WIP: 'WIP',
  DONE: 'DONE',
  SOLVED: 'SOLVED',
  FIXED: 'FIXED',
  DEFAULT: 'DEFAULT',
  // reject
  ...ARTICLE_CAT_REJECT,
} as Record<Uppercase<TArticleState>, Uppercase<TArticleState>>

export const ARTICLE_CAT_MODE = {
  FILTER: 'filter',
  FULL: 'full',
} as Record<Uppercase<TArticleCatMode>, TArticleCatMode>
