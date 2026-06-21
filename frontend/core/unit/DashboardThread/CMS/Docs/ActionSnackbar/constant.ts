export const TREE_ACTION = {
  TAB: 'Tab',
  GROUP: 'Group',
} as const

export const DOC_ACTION = {
  INFO: 'Doc info',
  DIFF: 'Version history',
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
  PUBLISHING: 'Publishing',
  PUBLISHED: 'Published',
  PUBLISH_FAILED: 'Failed to publish',
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

export const REVISION_DRAWER = {
  TITLE: 'Version history',
  EMPTY: 'No revisions yet',
  LOADING: 'Loading revisions',
  LOAD_FAILED: 'Failed to load revisions',
  RESTORE: 'Restore',
  CONFIRM_RESTORE: 'Confirm',
  RESTORE_FAILED: 'Failed to restore revision',
  RESTORED: 'Revision restored',
  SAVE_BEFORE_RESTORE: 'Save the current draft before restoring a revision',
  UNKNOWN_AUTHOR: 'Unknown author',
  UNKNOWN_TIME: 'Unknown time',
  JUST_NOW: 'just now',
  EMPTY_EXCERPT: 'No text content',
  CURRENT_CHANGES: 'Current changes',
  STAGED_TAB: 'Staged',
  PUBLISHED_TAB: 'Published',
  COMPARE_WITH_CURRENT: 'Compared with current draft',
  COMPARE_WITH_BASELINE: 'Compared with baseline',
  COMPARE_WITH_LATEST_SAVED: 'Compared with latest saved version',
  NO_CURRENT_CHANGES: 'No current changes',
  SELECT_REVISION: 'Select a revision to preview changes',
  CHECKPOINT_FAILED: 'Failed to save revision checkpoint',
  HIDDEN_DUPLICATES: 'duplicate checkpoints hidden',
} as const
