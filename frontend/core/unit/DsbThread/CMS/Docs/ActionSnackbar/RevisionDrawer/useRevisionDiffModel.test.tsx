import type { TRichEditorValue } from '@groupher/rich-editor'
import type { TRichEditorDiffResult } from '@groupher/rich-editor/diff'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TRevisionHistory } from './model'
import useRevisionDiffModel from './useRevisionDiffModel'

const mocks = vi.hoisted(() => ({
  getOrCompute: vi.fn(),
  terminate: vi.fn(),
}))

vi.mock('./diffClient', () => ({
  default: class MockRevisionDiffClient {
    getOrCompute = mocks.getOrCompute
    terminate = mocks.terminate
  },
}))

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const value = (text: string): TRichEditorValue => [{ type: 'p', children: [{ text }] }]

const diffResult = (additions: number): TRichEditorDiffResult =>
  ({
    diffValue: { kind: 'rich-editor-diff', nodes: value('diff') },
    hasChanges: true,
    stats: { additions, deletions: 0 },
  }) as TRichEditorDiffResult

const history: TRevisionHistory = {
  currentBaselineValue: value('draft'),
  hiddenDraftDuplicateCount: 0,
  publishedBaselineValue: value('published'),
  publishedPairs: [],
  stagedPairs: [],
}

describe('useRevisionDiffModel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', class {})
    mocks.getOrCompute.mockReset()
    mocks.terminate.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('debounces publish stats and discards stale worker responses', async () => {
    const first = deferred<TRichEditorDiffResult>()
    const second = deferred<TRichEditorDiffResult>()
    mocks.getOrCompute.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook(
      ({ bodyValue }) => useRevisionDiffModel(history, bodyValue),
      { initialProps: { bodyValue: value('first') } },
    )

    await act(async () => {})
    act(() => vi.advanceTimersByTime(200))
    expect(mocks.getOrCompute).toHaveBeenCalledTimes(1)
    expect(mocks.getOrCompute).toHaveBeenLastCalledWith(expect.any(Object), 'publish')

    rerender({ bodyValue: value('second') })
    act(() => vi.advanceTimersByTime(200))
    expect(mocks.getOrCompute).toHaveBeenCalledTimes(2)

    await act(async () => first.resolve(diffResult(9)))
    expect(result.current.revisionDiffModel.publish.pending).toBe(true)

    await act(async () => second.resolve(diffResult(1)))
    expect(result.current.revisionDiffModel.publish).toMatchObject({
      after: value('second'),
      hasChanges: true,
      pending: false,
      stats: { additions: 1, deletions: 0 },
    })
  })

  it('does not compute current or historical pairs until a drawer tab starts them', async () => {
    mocks.getOrCompute.mockResolvedValue(diffResult(1))
    const bodyValue = value('current')
    const { result } = renderHook(() => useRevisionDiffModel(history, bodyValue))

    await act(async () => {})
    expect(mocks.getOrCompute).not.toHaveBeenCalled()

    let stop = () => undefined
    await act(async () => {
      stop = result.current.startHistoryDiff('staged')
    })

    expect(mocks.getOrCompute).toHaveBeenCalledTimes(1)
    expect(mocks.getOrCompute).toHaveBeenCalledWith(expect.any(Object), 'current')
    act(stop)
  })

  it('refreshes the staged current pair through the debounced live path', async () => {
    mocks.getOrCompute.mockResolvedValue(diffResult(1))
    const { result, rerender } = renderHook(
      ({ bodyValue }) => useRevisionDiffModel(history, bodyValue),
      { initialProps: { bodyValue: value('first') } },
    )

    await act(async () => {})
    let stop = () => undefined
    await act(async () => {
      stop = result.current.startHistoryDiff('staged')
    })
    mocks.getOrCompute.mockClear()

    rerender({ bodyValue: value('second') })
    expect(result.current.revisionDiffModel.current.pending).toBe(true)
    expect(mocks.getOrCompute).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTimeAsync(200))
    expect(mocks.getOrCompute).toHaveBeenCalledWith(expect.any(Object), 'publish')
    expect(mocks.getOrCompute).toHaveBeenCalledWith(expect.any(Object), 'current')
    expect(result.current.revisionDiffModel.current).toMatchObject({
      after: value('second'),
      hasChanges: true,
      pending: false,
    })
    act(stop)
  })

  it('loads the current card with an explicit current cache scope', async () => {
    mocks.getOrCompute.mockResolvedValue(diffResult(1))
    const bodyValue = value('current')
    const { result } = renderHook(() => useRevisionDiffModel(history, bodyValue))

    await act(async () => {})
    const pair = {
      after: value('current'),
      before: value('draft'),
      key: 'current:test',
    }
    await act(async () => {
      await result.current.loadDiffResult(pair, 'current')
    })

    expect(mocks.getOrCompute).toHaveBeenCalledWith(pair, 'current')
  })
})
