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
  PUBLISH: 'Publish',
  PUBLISH_CURRENT: 'Publish current node',
  PUBLISH_OPTIONS: 'Publish options',
  PUBLISH_SCOPE: 'Publish current node and its document',
} as const

export const DIFF_STATUS = {
  ADD: '+12',
  REMOVE: '-3',
} as const
