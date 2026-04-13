export const CAT = 'cat'
export const STATE = 'state'
export const ORDER = 'order'

export const ARTICLE_CAT_REJECT = {
  REJECT: 'reject', // 关闭
  REJECT_DUP: 'reject_dup', // 重复问题
  REJECT_NO_PLAN: 'reject_no_plan', // 无计划
  REJECT_REPRO: 'reject_repro', // 无法重现
  REJECT_STALE: 'reject_stale', // 已过时
} as const

export const ARTICLE_ORDER = {
  UPVOTES: 'UPVOTES',
  COMMENTS: 'COMMENTS',
  PUBLISH: 'PUBLISH',
  VIEWS: 'VIEWS',
} as const

export const ARTICLE_CAT = {
  FEATURE: 'feature',
  BUG: 'bug',
  QUESTION: 'question',
  OTHER: 'other',
} as const

export const ARTICLE_STATE = {
  BACKLOG: 'backlog',
  TODO: 'todo',
  WIP: 'wip',
  DONE: 'done',
  RESOLVED: 'resolved',
  SOLVED: 'solved',
  FIXED: 'fixed',
  DEFAULT: 'default',
  // reject
  ...ARTICLE_CAT_REJECT,
} as const

export const ARTICLE_CAT_MODE = {
  FILTER: 'filter',
  FULL: 'full',
} as const
