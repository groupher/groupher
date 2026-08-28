import type { TRichEditorValue } from '@groupher/rich-editor'
import type { TRichEditorDiffResult } from '@groupher/rich-editor/diff'

import type { TRevisionDiffWorkerRequest, TRevisionDiffWorkerResponse } from './diffWorkerProtocol'
import type { TRevisionDiffPair } from './model'

export type TRevisionDiffScope = 'current' | 'history' | 'publish'

type TPendingRequest = {
  reject: (reason: Error) => void
  resolve: (value: TRichEditorDiffResult) => void
}

const MAX_HISTORY_RESULTS = 32

const detachEditorValue = (value: TRichEditorValue): TRichEditorValue =>
  JSON.parse(JSON.stringify(value)) as TRichEditorValue

export default class RevisionDiffClient {
  private readonly cache = new Map<string, TRichEditorDiffResult>()
  private readonly inflight = new Map<string, Promise<TRichEditorDiffResult>>()
  private nextRequestId = 0
  private readonly pending = new Map<number, TPendingRequest>()
  private readonly scopeKeys = new Map<TRevisionDiffScope, string>()
  private readonly worker: Worker

  constructor() {
    const workerUrl =
      process.env.NODE_ENV === 'production'
        ? '/dashboard/worker-revision-diff.js'
        : '/worker-revision-diff.js'
    this.worker = new Worker(workerUrl, { type: 'module' })
    this.worker.onmessage = ({ data }: MessageEvent<TRevisionDiffWorkerResponse>) => {
      const pending = this.pending.get(data.requestId)
      if (!pending) return

      this.pending.delete(data.requestId)
      if (data.type === 'error') {
        pending.reject(new Error(data.message))
        return
      }

      pending.resolve(data.result)
    }
    this.worker.onerror = ({ message }) => {
      const error = new Error(message || 'Revision diff worker failed')
      for (const pending of this.pending.values()) pending.reject(error)
      this.pending.clear()
    }
  }

  getOrCompute(
    pair: TRevisionDiffPair,
    scope: TRevisionDiffScope = 'history',
  ): Promise<TRichEditorDiffResult> {
    this.activateScope(pair.key, scope)

    const cached = this.cache.get(pair.key)
    if (cached) {
      this.touch(pair.key, cached)
      return Promise.resolve(cached)
    }

    const inflight = this.inflight.get(pair.key)
    if (inflight) return inflight

    const requestId = ++this.nextRequestId
    const resultPromise = this.request({
      ...pair,
      cacheKey: pair.key,
      requestId,
      type: 'compute',
    })
      .then((result) => {
        if (scope === 'history' || this.scopeKeys.get(scope) === pair.key) {
          this.touch(pair.key, result)
        }
        return result
      })
      .finally(() => this.inflight.delete(pair.key))

    this.inflight.set(pair.key, resultPromise)
    return resultPromise
  }

  terminate(): void {
    this.worker.terminate()
    const error = new Error('Revision diff client terminated')
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
    this.inflight.clear()
    this.cache.clear()
  }

  private activateScope(cacheKey: string, scope: TRevisionDiffScope): void {
    if (scope === 'history') return

    const previousKey = this.scopeKeys.get(scope)
    if (previousKey && previousKey !== cacheKey) this.cache.delete(previousKey)
    this.scopeKeys.set(scope, cacheKey)
  }

  private request(request: TRevisionDiffWorkerRequest): Promise<TRichEditorDiffResult> {
    return new Promise<TRichEditorDiffResult>((resolve, reject) => {
      this.pending.set(request.requestId, { reject, resolve })

      try {
        // useDocsEditor exposes values from Valtio useSnapshot. Nested tracking
        // proxies are valid editor values but cannot cross a Worker boundary.
        this.worker.postMessage({
          ...request,
          after: detachEditorValue(request.after),
          before: detachEditorValue(request.before),
        })
      } catch (error) {
        this.pending.delete(request.requestId)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  private touch(cacheKey: string, result: TRichEditorDiffResult): void {
    this.cache.delete(cacheKey)
    this.cache.set(cacheKey, result)

    const pinnedKeys = new Set(this.scopeKeys.values())
    const pinnedResultCount = Array.from(pinnedKeys).filter((key) => this.cache.has(key)).length
    while (this.cache.size > MAX_HISTORY_RESULTS + pinnedResultCount) {
      const oldestHistoryKey = Array.from(this.cache.keys()).find((key) => !pinnedKeys.has(key))
      if (!oldestHistoryKey) return
      this.cache.delete(oldestHistoryKey)
    }
  }
}
