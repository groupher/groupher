import type { TTransKey } from '~/spec'

export const ACTION_SNACKBAR_WIDTH = 'w-fit'

export const DOC_PUBLISH_PLAN_RELOAD_EVENT = 'groupher:doc-publish-plan:reload'
export const DOC_REVISION_RELOAD_EVENT = 'groupher:doc-revision:reload'

export const TREE_ACTION_LABEL_KEY = {
  TAB: 'dsb.doc.action.tab',
  TAB_ADDED: 'dsb.doc.action.tab_added',
  GROUP: 'dsb.doc.action.group',
} as const satisfies Record<string, TTransKey>

export const DOC_ACTION_LABEL_KEY = {
  INFO: 'dsb.doc.action.info',
  DIFF: 'dsb.doc.action.version_history',
  IMPORT: 'dsb.doc.action.import_content',
  CHECK: 'dsb.doc.action.check_quality',
  COMMENT: 'dsb.doc.action.comment',
  MORE: 'dsb.doc.action.more_actions',
} as const satisfies Record<string, TTransKey>

export const SAVE_ACTION_LABEL_KEY = {
  SAVED: 'dsb.doc.save.saved',
  SYNCING: 'dsb.doc.save.syncing',
  SAVE_FAILED: 'dsb.doc.save.failed',
  PUBLISH: 'dsb.doc.save.publish',
  PUBLISH_CURRENT: 'dsb.doc.save.publish_current',
  PUBLISH_OPTIONS: 'dsb.doc.save.publish_options',
  PUBLISH_SCOPE: 'dsb.doc.save.publish_scope',
  PUBLISH_WITH_COVER_SYNC: 'dsb.doc.save.publish_with_cover_sync',
  PUBLISH_WITH_COVER_SYNC_DESC: 'dsb.doc.save.publish_with_cover_sync_desc',
  PUBLISH_DOC_ONLY: 'dsb.doc.save.publish_doc_only',
  PUBLISH_DOC_ONLY_DESC: 'dsb.doc.save.publish_doc_only_desc',
  PUBLISH_ALL_UNPUBLISHED: 'dsb.doc.save.publish_all_unpublished',
  PUBLISH_ALL_UNPUBLISHED_DESC: 'dsb.doc.save.publish_all_unpublished_desc',
  PUBLISHING: 'dsb.doc.save.publishing',
  PUBLISHED: 'dsb.doc.save.published',
  PUBLISHED_ALL_UNPUBLISHED: 'dsb.doc.save.published_all_unpublished',
  PUBLISH_FAILED: 'dsb.doc.save.publish_failed',
  PUBLISH_DOC_CHANGES: 'dsb.doc.save.publish_doc_changes',
  PUBLISH_TREE_CHANGES: 'dsb.doc.save.publish_tree_changes',
  PUBLISH_NO_CHANGES: 'dsb.doc.save.publish_no_changes',
} as const satisfies Record<string, TTransKey>

export const SAVE_STATUS_LABEL = {
  idle: SAVE_ACTION_LABEL_KEY.SAVED,
  saved: SAVE_ACTION_LABEL_KEY.SAVED,
  dirty: SAVE_ACTION_LABEL_KEY.SAVED,
  saving: SAVE_ACTION_LABEL_KEY.SYNCING,
  error: SAVE_ACTION_LABEL_KEY.SAVE_FAILED,
} as const

export const DOC_INFO_LABEL_KEY = {
  TITLE: 'dsb.doc.info.title',
  CLOSE: 'dsb.doc.info.close',
  TITLE_LABEL: 'dsb.doc.info.field.title',
  SLUG_LABEL: 'dsb.doc.info.field.slug',
  DOCUMENT_ID_LABEL: 'dsb.doc.info.field.document_id',
  WORD_COUNT_LABEL: 'dsb.doc.info.field.word_count',
  STAGE_LABEL: 'dsb.doc.info.field.stage',
  STAGE_PUBLISHED: 'dsb.doc.info.stage.published',
  STAGE_UNPUBLISHED: 'dsb.doc.info.stage.unpublished',
  CREATION_DATE_LABEL: 'dsb.doc.info.field.creation_date',
  CREATED_BY_LABEL: 'dsb.doc.info.field.created_by',
  LAST_MODIFIED_LABEL: 'dsb.doc.info.field.last_modified',
  LAST_MODIFIED_BY_LABEL: 'dsb.doc.info.field.last_modified_by',
} as const satisfies Record<string, TTransKey>

export const DOC_INFO_EMPTY = '-'

export const DIFF_STATUS = {
  ADD: '+12',
  REMOVE: '-3',
} as const

export const REVISION_LABEL_KEY = {
  TITLE: 'dsb.doc.revision.title',
  CLOSE: 'dsb.doc.revision.close',
  EMPTY: 'dsb.doc.revision.empty',
  LOADING: 'dsb.doc.revision.loading',
  LOAD_FAILED: 'dsb.doc.revision.load_failed',
  RESTORE: 'dsb.doc.revision.restore',
  CONFIRM_RESTORE: 'dsb.doc.revision.confirm_restore',
  RESTORE_FAILED: 'dsb.doc.revision.restore_failed',
  RESTORED: 'dsb.doc.revision.restored',
  SAVE_BEFORE_RESTORE: 'dsb.doc.revision.save_before_restore',
  UNKNOWN_AUTHOR: 'dsb.doc.revision.unknown_author',
  UNKNOWN_TIME: 'dsb.doc.revision.unknown_time',
  JUST_NOW: 'dsb.doc.revision.just_now',
  MIN_AGO: 'dsb.doc.revision.min_ago',
  HR_AGO: 'dsb.doc.revision.hr_ago',
  DAY_AGO: 'dsb.doc.revision.day_ago',
  BY: 'dsb.doc.revision.by',
  EMPTY_EXCERPT: 'dsb.doc.revision.empty_excerpt',
  CURRENT_CHANGES: 'dsb.doc.revision.current_changes',
  STAGED_TAB: 'dsb.doc.revision.staged_tab',
  PUBLISHED_TAB: 'dsb.doc.revision.published_tab',
  COMPARE_WITH_CURRENT: 'dsb.doc.revision.compare_with_current',
  COMPARE_WITH_BASELINE: 'dsb.doc.revision.compare_with_baseline',
  COMPARE_WITH_LATEST_SAVED: 'dsb.doc.revision.compare_with_latest_saved',
  NO_CURRENT_CHANGES: 'dsb.doc.revision.no_current_changes',
  SELECT_REVISION: 'dsb.doc.revision.select_revision',
  CHECKPOINT_FAILED: 'dsb.doc.revision.checkpoint_failed',
  HIDDEN_DUPLICATES: 'dsb.doc.revision.hidden_duplicates',
} as const satisfies Record<string, TTransKey>
