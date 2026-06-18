export const TREE_ACTION = {
  TAB: 'Tab',
  GROUP: 'Group',
} as const

export const DOC_ACTION = {
  INFO: 'Doc info',
  DIFF: 'Diff',
  IMPORT: 'Import content',
  CHECK: 'Check doc quality',
  COMMENT: 'Comment',
  MORE: 'More actions',
} as const

export const SAVE_ACTION = {
  SAVED: 'Saved',
  SYNCING: 'Syncing',
  UNSAVED: 'Unsaved',
  SAVE_FAILED: 'Save failed',
  PUBLISH: 'Publish',
  PUBLISH_CURRENT: 'Publish current node',
  PUBLISH_OPTIONS: 'Publish options',
  PUBLISH_SCOPE: 'Publish current node and its document',
} as const

export const SAVE_STATUS_LABEL = {
  idle: SAVE_ACTION.SAVED,
  saved: SAVE_ACTION.SAVED,
  dirty: SAVE_ACTION.UNSAVED,
  saving: SAVE_ACTION.SYNCING,
  error: SAVE_ACTION.SAVE_FAILED,
} as const

export const DOC_INFO_MODAL = {
  TITLE: 'Document info',
  TITLE_LABEL: 'Title',
  SLUG_LABEL: 'URL Slug',
  DOCUMENT_ID_LABEL: 'Document ID',
  WORD_COUNT_LABEL: 'Word count',
  CREATION_DATE_LABEL: 'Creation date',
  CREATED_BY_LABEL: 'Created by',
  LAST_MODIFIED_LABEL: 'Last modified',
  LAST_MODIFIED_BY_LABEL: 'Last modified by',
  EMPTY: '-',
} as const

export const DIFF_STATUS = {
  ADD: '+12',
  REMOVE: '-3',
} as const
