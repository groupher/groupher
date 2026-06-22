import type { TRichEditorValue } from '@groupher/rich-editor'

export const EMPTY_EDITOR_VALUE: TRichEditorValue = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
]

export const DOC_AUTO_SAVE_DELAY = 1600
export const DOC_DRAFT_REVISION_CHECKPOINT_DELAY = 120_000
