import type { TTransKey } from '~/spec'

export const DOC_EDITOR_QUERY_PARAM = {
  DOC_ID: 'docId',
} as const

export const DOC_EDITOR_LABEL_KEY = {
  STAGE_DRAFT: 'dsb.doc.editor.stage.draft',
  STAGE_PUBLISHED: 'dsb.doc.editor.stage.published',
} as const satisfies Record<string, TTransKey>

export const DOC_EDITOR_MODE = {
  EDIT: 'edit',
  PREVIEW: 'preview',
} as const

export type TDocEditorMode = (typeof DOC_EDITOR_MODE)[keyof typeof DOC_EDITOR_MODE]
