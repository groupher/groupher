export const CAT = 'cat'
export const STATUS = 'status'
export const ORDER = 'order'

export const ARTICLE_STATUS_REJECT = {
  REJECT: 'REJECT', // 关闭
  REJECT_DUP: 'REJECT_DUP', // 重复问题
  REJECT_NO_PLAN: 'REJECT_NO_PLAN', // 无计划
  REJECT_REPRO: 'REJECT_REPRO', // 无法重现
  REJECT_STALE: 'REJECT_STALE', // 已过时
} as const

export const ARTICLE_ORDER = {
  UPVOTES: 'UPVOTES',
  COMMENTS: 'COMMENTS',
  PUBLISH: 'PUBLISH',
  VIEWS: 'VIEWS',
} as const

export const ARTICLE_CAT = {
  IDEA: 'IDEA',
  BUG: 'BUG',
  QA: 'QA',
  DISCUSSION: 'DISCUSSION',
} as const

export const ARTICLE_STATUS = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  WIP: 'WIP',
  DONE: 'DONE',
  RESOLVED: 'RESOLVED',
  SOLVED: 'SOLVED',
  FIXED: 'FIXED',
  DEFAULT: 'DEFAULT',
  // reject
  ...ARTICLE_STATUS_REJECT,
} as const

export const ARTICLE_CAT_MODE = {
  FILTER: 'filter',
  FULL: 'full',
} as const
