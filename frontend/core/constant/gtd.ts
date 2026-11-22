import { valueKeyedEnum } from '~/lib/enumValues'
import { ArticleCatEnum, ArticleOrderEnum } from '~/lib/graphql/generated/enums'

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

export const ARTICLE_ORDER = valueKeyedEnum(ArticleOrderEnum)

export const ARTICLE_CAT = valueKeyedEnum(ArticleCatEnum)

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
