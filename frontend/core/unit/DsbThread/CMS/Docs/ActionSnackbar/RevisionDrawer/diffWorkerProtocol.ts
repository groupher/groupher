import type { TRichEditorValue } from '@groupher/rich-editor'
import type { TRichEditorDiffResult } from '@groupher/rich-editor/diff'

export type TRevisionDiffWorkerRequest = {
  after: TRichEditorValue
  before: TRichEditorValue
  cacheKey: string
  requestId: number
  type: 'compute'
}

export type TRevisionDiffWorkerResponse =
  | {
      cacheKey: string
      requestId: number
      result: TRichEditorDiffResult
      type: 'result'
    }
  | {
      message: string
      requestId: number
      type: 'error'
    }
