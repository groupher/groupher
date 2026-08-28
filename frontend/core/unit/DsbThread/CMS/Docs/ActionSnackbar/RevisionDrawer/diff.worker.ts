/// <reference lib="webworker" />

import { computeRichEditorDiff } from '@groupher/rich-editor/diff'

import type { TRevisionDiffWorkerRequest, TRevisionDiffWorkerResponse } from './diffWorkerProtocol'

self.onmessage = ({ data }: MessageEvent<TRevisionDiffWorkerRequest>): void => {
  try {
    const response: TRevisionDiffWorkerResponse = {
      cacheKey: data.cacheKey,
      requestId: data.requestId,
      result: computeRichEditorDiff(data.before, data.after),
      type: 'result',
    }
    self.postMessage(response)
  } catch (error) {
    const response: TRevisionDiffWorkerResponse = {
      message: error instanceof Error ? error.message : String(error),
      requestId: data.requestId,
      type: 'error',
    }
    self.postMessage(response)
  }
}

export {}
