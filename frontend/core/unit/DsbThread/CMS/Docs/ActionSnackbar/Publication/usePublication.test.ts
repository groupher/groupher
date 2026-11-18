import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import usePublication from './usePublication'
const mocks = vi.hoisted(() => ({ request: vi.fn(), execute: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/query/mutation/optimistic/execute', () => ({ executeCommand: mocks.execute }))
vi.mock('./schema', () => ({
  preview: 'preview',
  diff: 'diff',
  releases: 'releases',
  release: 'release',
  snapshots: 'snapshots',
  articleEvents: 'article-events',
  articleEvent: 'article-event',
  articleDiff: 'article-diff',
  policy: 'policy',
  approve: 'approve',
  configure: 'configure',
}))
const versions = {
  public_release_id: 1,
  queue_revision: 3,
  public_presentation_revision: 4,
  approval_policy_revision: 0,
  approval_id: null,
  planner_version: 1,
}
const result = { versions, nodes: [], page: null }
describe('publication view consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('pins page navigation, clears stale content on rejection, and explicitly refreshes', async () => {
    mocks.request
      .mockResolvedValueOnce({ docsQueuePreview: result })
      .mockRejectedValueOnce(new Error('changed'))
      .mockResolvedValueOnce({
        docsQueuePreview: { ...result, versions: { ...versions, queue_revision: 4 } },
      })
    const view = renderHook(() => usePublication('home'))
    await act(() => view.result.current.read('preview', { refresh: true }))
    await act(() => view.result.current.read('preview', { articleId: 'doc' }))
    expect(mocks.request.mock.calls[1][1].versions).toBe(JSON.stringify(versions))
    expect(view.result.current.data).toBeNull()
    expect(view.result.current.error).toBeTruthy()
    await act(() => view.result.current.read('preview', { refresh: true }))
    expect(mocks.request.mock.calls[2][1].versions).toBeUndefined()
    expect(view.result.current.error).toBeNull()
  })
  it('does not let a late preview response replace a newly selected history view', async () => {
    let resolve!: (value: unknown) => void
    mocks.request
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r
          }),
      )
      .mockResolvedValueOnce({ docsReleaseHistory: { items: [], next_id: null } })
    const view = renderHook(() => usePublication('home'))
    let pending!: Promise<void>
    act(() => {
      pending = view.result.current.read('preview')
    })
    act(() => view.result.current.cancel())
    await act(() => view.result.current.read('history'))
    await act(async () => {
      resolve({ docsQueuePreview: result })
      await pending
    })
    expect(view.result.current.data).toEqual({ items: [], next_id: null })
  })
  it('keeps the two approval baselines explicit and writes only from an action', async () => {
    mocks.request.mockResolvedValue({ docsApprovalDiff: result })
    const view = renderHook(() => usePublication('home'))
    await act(() => view.result.current.read('diff', { baseline: 'APPROVAL' }))
    expect(mocks.request.mock.calls[0][1].baseline).toBe('APPROVAL')
    expect(mocks.execute).not.toHaveBeenCalled()
    await act(() => view.result.current.read('diff', { baseline: 'PUBLIC', refresh: true }))
    expect(mocks.request.mock.calls[1][1].baseline).toBe('PUBLIC')
    mocks.execute.mockResolvedValueOnce({})
    await act(() => view.result.current.mutate('approve', { queueRevision: 3 }))
    expect(mocks.execute.mock.calls[0][0].variables).toEqual({
      community: 'home',
      queueRevision: 3,
    })
  })
  it('loads policy independently from preview and history permissions', async () => {
    mocks.request.mockResolvedValueOnce({
      docsQueuePolicy: {
        approval_required: false,
        allow_self_approval: false,
        approval_policy_revision: 0,
      },
    })
    const view = renderHook(() => usePublication('home'))
    await act(() => view.result.current.read('settings'))
    expect(mocks.request.mock.calls[0][0]).toBe('policy')
  })
  it('compares selected immutable snapshots through the Article history query', async () => {
    const articleDiff = { fields: { title: { before: 'old', after: 'new' } } }
    mocks.request.mockResolvedValueOnce({ articleDiff })
    const view = renderHook(() => usePublication('home'))
    await act(() =>
      view.result.current.read('history', {
        articleId: 'article-1',
        beforeSnapshotId: 'snapshot-1',
        afterSnapshotId: 'snapshot-2',
      }),
    )
    expect(mocks.request.mock.calls[0][0]).toBe('article-diff')
    expect(mocks.request.mock.calls[0][1]).toMatchObject({
      articleId: 'article-1',
      before: { type: 'SNAPSHOT', snapshotId: 'snapshot-1' },
      after: { type: 'SNAPSHOT', snapshotId: 'snapshot-2' },
    })
    expect(view.result.current.data).toEqual(articleDiff)
  })
  it('serializes Article event pagination for the Json GraphQL scalar', async () => {
    mocks.request.mockResolvedValueOnce({
      pagedArticleEvents: { items: [], next_cursor: null },
    })
    const view = renderHook(() => usePublication('home'))
    await act(() =>
      view.result.current.read('history', {
        articleId: 'article-1',
        articleHistory: true,
        cursor: { sequence: 12 },
      }),
    )
    expect(mocks.request.mock.calls[0][0]).toBe('article-events')
    expect(mocks.request.mock.calls[0][1].pagi).toBe(
      JSON.stringify({ limit: 20, cursor: { sequence: 12 } }),
    )
  })
  it('keeps a newer view intact when an earlier mutation finishes late', async () => {
    let resolve!: (value: unknown) => void
    mocks.execute.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    mocks.request.mockResolvedValueOnce({ docsReleaseHistory: { items: [], next_id: null } })
    const view = renderHook(() => usePublication('home'))
    let pending!: Promise<boolean>
    act(() => {
      pending = view.result.current.mutate('approve', { queueRevision: 3 })
    })
    act(() => view.result.current.cancel())
    await act(() => view.result.current.read('history'))
    await act(async () => {
      resolve({})
      expect(await pending).toBe(false)
    })
    expect(view.result.current.data).toEqual({ items: [], next_id: null })
  })
})
