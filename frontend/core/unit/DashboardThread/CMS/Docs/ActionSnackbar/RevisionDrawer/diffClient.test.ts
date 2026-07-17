import type { TRichEditorValue } from '@groupher/rich-editor'
import type { TRichEditorDiffResult } from '@groupher/rich-editor/diff'
import { renderHook } from '@testing-library/react'
import { proxy, useSnapshot } from 'valtio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RevisionDiffClient from './diffClient'
import type { TRevisionDiffWorkerRequest, TRevisionDiffWorkerResponse } from './diffWorkerProtocol'

class FakeWorker {
  static instance: FakeWorker

  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent<TRevisionDiffWorkerResponse>) => void) | null = null
  postMessage = vi.fn<(request: TRevisionDiffWorkerRequest) => void>()
  terminate = vi.fn()

  constructor() {
    FakeWorker.instance = this
  }

  emit(data: TRevisionDiffWorkerResponse): void {
    this.onmessage?.({ data } as MessageEvent<TRevisionDiffWorkerResponse>)
  }
}

const value = (text: string): TRichEditorValue => [{ type: 'p', children: [{ text }] }]

const diffResult = (text: string): TRichEditorDiffResult =>
  ({
    diffValue: { kind: 'rich-editor-diff', nodes: value(text) },
    hasChanges: true,
    stats: { additions: 1, deletions: 0 },
  }) as TRichEditorDiffResult

const resolveLatestRequest = (result: TRichEditorDiffResult): void => {
  const request = FakeWorker.instance.postMessage.mock.calls.at(-1)?.[0]
  if (!request) throw new Error('Expected a worker request')

  FakeWorker.instance.emit({
    cacheKey: request.cacheKey,
    requestId: request.requestId,
    result,
    type: 'result',
  })
}

describe('RevisionDiffClient', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends one stateless compute request and resolves the full result', async () => {
    const client = new RevisionDiffClient()
    const pair = { after: value('after'), before: value('before'), key: 'revision:2:1' }
    const resultPromise = client.getOrCompute(pair)
    const request = FakeWorker.instance.postMessage.mock.calls[0][0]
    const result = diffResult('after')

    expect(request).toEqual({
      ...pair,
      cacheKey: pair.key,
      requestId: 1,
      type: 'compute',
    })

    resolveLatestRequest(result)
    await expect(resultPromise).resolves.toBe(result)
  })

  it('detaches Valtio tracking proxies before crossing the worker boundary', async () => {
    const store = proxy({ after: value('after'), before: value('before') })
    const { result: snapshotResult } = renderHook(() => useSnapshot(store))
    const client = new RevisionDiffClient()
    const pair = {
      after: snapshotResult.current.after as TRichEditorValue,
      before: snapshotResult.current.before as TRichEditorValue,
      key: 'live:tracked',
    }

    expect(() => structuredClone(pair)).toThrow()

    const resultPromise = client.getOrCompute(pair)
    const request = FakeWorker.instance.postMessage.mock.calls[0][0]
    const result = diffResult('after')

    expect(() => structuredClone(request)).not.toThrow()
    expect(request.after).toEqual(value('after'))
    expect(request.before).toEqual(value('before'))
    expect(request.after).not.toBe(pair.after)
    expect(request.before).not.toBe(pair.before)

    resolveLatestRequest(result)
    await expect(resultPromise).resolves.toBe(result)
  })

  it('serves repeated document pairs from the main-thread cache', async () => {
    const client = new RevisionDiffClient()
    const pair = { after: value('after'), before: value('before'), key: 'revision:2:1' }
    const result = diffResult('after')
    const firstPromise = client.getOrCompute(pair)

    resolveLatestRequest(result)
    await firstPromise

    await expect(client.getOrCompute(pair)).resolves.toBe(result)
    expect(FakeWorker.instance.postMessage).toHaveBeenCalledTimes(1)
  })

  it('deduplicates the same in-flight pair across publish and current scopes', async () => {
    const client = new RevisionDiffClient()
    const pair = { after: value('after'), before: value('before'), key: 'live:1' }
    const publishPromise = client.getOrCompute(pair, 'publish')
    const currentPromise = client.getOrCompute(pair, 'current')
    const result = diffResult('after')

    expect(FakeWorker.instance.postMessage).toHaveBeenCalledTimes(1)
    resolveLatestRequest(result)
    await expect(Promise.all([publishPromise, currentPromise])).resolves.toEqual([result, result])
  })

  it('recomputes a historical pair after its bounded cache entry is evicted', async () => {
    const client = new RevisionDiffClient()

    for (let index = 0; index < 33; index += 1) {
      const promise = client.getOrCompute({
        after: value(`after-${index}`),
        before: value(`before-${index}`),
        key: `revision:${index}`,
      })
      resolveLatestRequest(diffResult(`after-${index}`))
      await promise
    }

    const evictedPairPromise = client.getOrCompute({
      after: value('after-0'),
      before: value('before-0'),
      key: 'revision:0',
    })

    expect(FakeWorker.instance.postMessage).toHaveBeenCalledTimes(34)
    resolveLatestRequest(diffResult('after-0'))
    await evictedPairPromise
  })
})
