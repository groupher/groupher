import { ARTICLE_CAT, ARTICLE_ORDER, ARTICLE_STATUS } from '~/const/gtd'
import type { TTransKey } from '~/spec'

const MENU = {
  ARROW_LEFT: 'ARROW_LEFT',
  ARROW_TO_LEFT: 'ARROW_TO_LEFT',
  ARROW_RIGHT: 'ARROW_RIGHT',
  ARROW_TO_RIGHT: 'ARROW_TO_RIGHT',
  //

  ARROW_UP: 'ARROW_UP',
  ARROW_TO_TOP: 'ARROW_TO_TOP',
  ARROW_DOWN: 'ARROW_DOWN',
  ARROW_TO_BOTTOM: 'ARROW_TO_BOTTOM',
  SETTING: 'SETTING',
  DELETE: 'DELETE',

  // sort
  PUBLISH: 'PUBLISH',
  UPVOTE: 'UPVOTE',
  COMMENT: 'COMMENT',
  VIEWS: 'VIEWS',
  // gtd
  TODO: 'TODO',
  WIP: 'WIP',
  DONE: 'DONE',
  CLOSE: 'CLOSE',
  IDEA: 'IDEA',
  BUG: 'BUG',
  HELP: 'HELP',
  ALL: 'ALL',
  DISCUSSION: 'DISCUSSION',
  TOOL: 'TOOL',
} as const

type TPostMenuItem = {
  key: string
  title: TTransKey
  desc?: string
  icon: (typeof MENU)[keyof typeof MENU]
}

export const POST_CAT_MENU_ITEMS = [
  {
    key: ARTICLE_CAT.IDEA,
    title: 'article.cat.idea',
    desc: '功能请求，提建议等',
    icon: MENU.IDEA,
  },
  {
    key: ARTICLE_CAT.BUG,
    title: 'article.cat.bug',
    desc: '使用中遇到的错误，逻辑 Bug 等等',
    icon: MENU.BUG,
  },
  {
    key: ARTICLE_CAT.QA,
    title: 'article.cat.qa',
    desc: '请求帮助，使用疑惑等',
    icon: MENU.HELP,
  },
  {
    key: ARTICLE_CAT.DISCUSSION,
    title: 'article.cat.discussion',
    desc: '一般讨论，其他话题',
    icon: MENU.DISCUSSION,
  },
] satisfies TPostMenuItem[]

export const POST_STATUS_MENU_ITEMS = [
  {
    key: ARTICLE_STATUS.BACKLOG,
    title: 'article.status.backlog',
    icon: MENU.TODO,
  },
  {
    key: ARTICLE_STATUS.TODO,
    title: 'article.status.todo',
    icon: MENU.TODO,
  },
  {
    key: ARTICLE_STATUS.WIP,
    title: 'article.status.wip',
    icon: MENU.WIP,
  },
  {
    key: ARTICLE_STATUS.DONE,
    title: 'article.status.done',
    icon: MENU.DONE,
  },
  {
    key: ARTICLE_STATUS.REJECT,
    title: 'article.status.reject',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATUS.REJECT_DUP,
    title: 'article.status.reject_dup',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATUS.REJECT_NO_PLAN,
    title: 'article.status.reject_no_plan',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATUS.REJECT_REPRO,
    title: 'article.status.reject_repro',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATUS.REJECT_STALE,
    title: 'article.status.reject_stale',
    icon: MENU.CLOSE,
  },
] satisfies TPostMenuItem[]

export const POST_ORDER_MENU_ITEMS = [
  {
    key: ARTICLE_ORDER.PUBLISH,
    title: 'article.order.publish',
    icon: MENU.PUBLISH,
  },
  {
    key: ARTICLE_ORDER.UPVOTES,
    title: 'article.order.upvotes',
    icon: MENU.UPVOTE,
  },
  {
    key: ARTICLE_ORDER.COMMENTS,
    title: 'article.order.comments',
    icon: MENU.COMMENT,
  },
  {
    key: ARTICLE_ORDER.VIEWS,
    title: 'article.order.views',
    icon: MENU.VIEWS,
  },
] satisfies TPostMenuItem[]

export default MENU
