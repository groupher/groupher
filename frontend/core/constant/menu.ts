import { ARTICLE_CAT, ARTICLE_ORDER, ARTICLE_STATE } from '~/const/gtd'

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
  FEATURE: 'FEATURE',
  BUG: 'BUG',
  HELP: 'HELP',
  ALL: 'ALL',
  OTHER: 'OTHER',
  TOOL: 'TOOL',
} as const

export const POST_CAT_MENU_ITEMS = [
  {
    key: ARTICLE_CAT.FEATURE,
    title: 'article.cat.feature',
    desc: '功能请求，提建议等',
    icon: MENU.FEATURE,
  },
  {
    key: ARTICLE_CAT.BUG,
    title: 'article.cat.bug',
    desc: '使用中遇到的错误，逻辑 Bug 等等',
    icon: MENU.BUG,
  },
  {
    key: ARTICLE_CAT.QUESTION,
    title: 'article.cat.question',
    desc: '请求帮助，使用疑惑等',
    icon: MENU.HELP,
  },
  {
    key: ARTICLE_CAT.OTHER,
    title: 'article.cat.other',
    desc: '一般讨论，其他话题',
    icon: MENU.OTHER,
  },
]

export const POST_STATE_MENU_ITEMS = [
  {
    key: ARTICLE_STATE.BACKLOG,
    title: 'article.state.backlog',
    icon: MENU.TODO,
  },
  {
    key: ARTICLE_STATE.TODO,
    title: 'article.state.todo',
    icon: MENU.TODO,
  },
  {
    key: ARTICLE_STATE.WIP,
    title: 'article.state.wip',
    icon: MENU.WIP,
  },
  {
    key: ARTICLE_STATE.DONE,
    title: 'article.state.done',
    icon: MENU.DONE,
  },
  {
    key: ARTICLE_STATE.REJECT,
    title: 'article.state.reject',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATE.REJECT_DUP,
    title: 'article.state.reject_dup',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATE.REJECT_NO_PLAN,
    title: 'article.state.reject_no_plan',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATE.REJECT_REPRO,
    title: 'article.state.reject_repro',
    icon: MENU.CLOSE,
  },
  {
    key: ARTICLE_STATE.REJECT_STALE,
    title: 'article.state.reject_stale',
    icon: MENU.CLOSE,
  },
]

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
]

export default MENU
