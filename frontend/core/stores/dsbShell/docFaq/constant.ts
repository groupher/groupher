export const DOC_FAQ_FIELD = 'docFaq'

export const DEFAULT_GROUP_ID = '__default__'
export const DEFAULT_GROUP_TITLE = 'General'
export const UNTITLED_GROUP_TITLE = 'Untitled group'
export const UNTITLED_ITEM_TITLE = 'Untitled question'
export const DUPLICATE_TITLE_SUFFIX = 'copy'

export const DOC_FAQ_SAVE_ZONE = {
  TITLE: 'title',
  DESC: 'desc',
  GROUP_TITLE: 'groupTitle',
  ITEM_TITLE: 'itemTitle',
  ITEM_DETAIL: 'itemDetail',
  MODE: 'mode',
  LIST_ORDER: 'listOrder',
} as const

export const DOC_FAQ_ITEM_ACTION = {
  RENAME: 'rename',
  DUPLICATE: 'duplicate',
  DELETE: 'delete',
} as const
