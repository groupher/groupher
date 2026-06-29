import { keys, mergeRight, reduce } from 'ramda'

import type { TArticleThread } from '~/spec'

import { ARTICLE_THREAD } from './thread'

type TArticleOpt =
  | `${Uppercase<TArticleThread>}_EDIT`
  | `${Uppercase<TArticleThread>}_VIEW`
  | `${Uppercase<TArticleThread>}_CREATE`

const DRAWER_ARTICLE_CRUD = reduce(
  mergeRight,
  {},
  keys(ARTICLE_THREAD).map((T) => {
    return {
      [`${T}_VIEW`]: `${T}_VIEW`,
      [`${T}_CREATE`]: `${T}_CREATE`,
      [`${T}_EDIT`]: `${T}_EDIT`,
    }
  }),
) as Record<TArticleOpt, string>

const TYPE = {
  CUR_THEME: 'cur_theme',

  // actions

  // drawer types
  DRAWER: {
    SEARCH_PANEL: 'SEARCH_PANEL',
    ACCOUNT_VIEW: 'ACCOUNT_VIEW',
    USER_VIEW: 'USER_VIEW',
    ACCOUNT_EDIT: 'ACCOUNT_EDIT',

    MAILS_VIEW: 'MAILS_VIEW',
    DSB_DESC: 'DSB_DESC',

    G_EDITOR: 'G_EDITOR',
    ...DRAWER_ARTICLE_CRUD,

    // custom background editor

    // passport
    PASSPORT_EDITOR: 'PASSPORT_EDITOR',

    // modeline
    MODELINE_MENU: 'MODELINE_MENU',

    // tag
    CREATE_TAG: 'CREATE_TAG',
    EDIT_TAG: 'EDIT_TAG',

    DOC_INFO: 'DOC_INFO',
    DOC_REVISION: 'DOC_REVISION',
    DOC_COVER_GROUP_SETTING: 'DOC_COVER_GROUP_SETTING',

    //
    LIST_USERS: 'LIST_USERS',
  },

  REPORT: {
    ARTICLE: 'ARTICLE',
    USER: 'USER',
    COMMENT: 'COMMENT',
    COMMUNITY: 'COMMUNITY',
  },

  // modeline menu type
  MM_TYPE: {
    GLOBAL_MENU: 'global_menu',
    COMMUNITY: 'community',
    FILTER: 'filter',
    EXPLORE: 'explore',
    PUBLISH: 'publish',
    SHARE: 'share',
    REPORT: 'report',
    COLLECT: 'collect',
    SEARCH: 'search',
    MORE: 'more',
    UPVOTE: 'upvote',
  },

  RES_STATE: {
    LOADING: 'LOADING',
    DONE: 'DONE',
    EMPTY: 'EMPTY',
  },
  // TODO: remove PAGE STATE
  LOADING: 'LOADING',
  NOT_FOUND: 'NOT_FOUND',
  RESULT: 'RESULT',
  RESULT_EMPTY: 'RESULT_EMPTY',
  //
}

export default TYPE
