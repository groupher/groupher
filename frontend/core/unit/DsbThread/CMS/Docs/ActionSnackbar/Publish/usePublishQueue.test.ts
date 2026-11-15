import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/docs'

import usePublishQueue from './usePublishQueue'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  refetch: vi.fn(),
  reloadDocDraft: vi.fn(),
  reloadSideTree: vi.fn(),
  setPublishRuntime: vi.fn(),
  queue: {
    revision: 4,
    approvalRequired: false,
    approvalStatus: null as 'PENDING' | 'APPROVED' | null,
    articles: [] as { articleId: string; title: string; workingCopyId: string; revision: number }[],
    treeChanges: [] as { nodeId: string; changeType: string }[],
  },
  dirty: false,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { docsPublishQueue: mocks.queue },
    refetch: mocks.refetch,
    error: null,
  }),
}))
vi.mock('~/query', () => ({ graphqlQueryOptions: vi.fn() }))
vi.mock('~/hooks/useEvent', () => ({ default: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
vi.mock('../../Editor/store/hooks', () => ({
  default: () => ({
    docDraftInfo: { id: 'doc', workingCopyRevision: 7 },
    publishView: { isDirty: mocks.dirty, isSaving: false },
    reloadDocDraft: mocks.reloadDocDraft,
    reloadSideTree: mocks.reloadSideTree,
    setPublishRuntime: mocks.setPublishRuntime,
  }),
}))

describe('Docs publish queue', () => {
  beforeEach(() => {
    mocks.request.mockReset().mockResolvedValue({})
    mocks.refetch.mockReset().mockResolvedValue({})
    mocks.reloadDocDraft.mockReset()
    mocks.reloadSideTree.mockReset()
    mocks.queue = {
      revision: 4,
      approvalRequired: false,
      approvalStatus: null,
      articles: [],
      treeChanges: [],
    }
    mocks.dirty = false
  })

  it('enqueues the saved default revision with the queue revision', async () => {
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.enqueue())
    expect(mocks.request).toHaveBeenCalledWith(
      S.enqueueDocs,
      expect.objectContaining({
        community: 'home',
        queueRevision: 4,
        entries: [{ articleId: 'doc', defaultRevision: 7 }],
        commandId: expect.any(String),
      }),
    )
  })

  it('releases the entire queue and reloads the aligned default copy', async () => {
    mocks.queue.articles = [{ articleId: 'doc', workingCopyId: 'copy', revision: 1, title: 'Doc' }]
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.release())
    expect(mocks.request).toHaveBeenCalledWith(
      S.releaseDocsQueue,
      expect.objectContaining({ community: 'home', queueRevision: 4 }),
    )
    expect(mocks.reloadDocDraft).toHaveBeenCalledOnce()
    expect(mocks.reloadSideTree).toHaveBeenCalledOnce()
  })

  it('does not release a queue that requires approval while it is pending', async () => {
    mocks.queue.approvalRequired = true
    mocks.queue.approvalStatus = 'PENDING'
    mocks.queue.articles = [{ articleId: 'doc', workingCopyId: 'copy', revision: 1, title: 'Doc' }]
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.release())
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('does not enqueue unsaved edits', async () => {
    mocks.dirty = true
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.enqueue())
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('requires field choices for a conflict and merges at the checked revisions', async () => {
    mocks.queue.articles = [{ articleId: 'doc', workingCopyId: 'copy', revision: 2, title: 'Doc' }]
    mocks.request
      .mockResolvedValueOnce({
        mergeDocsQueueCopy: {
          conflict: {
            fields: ['TITLE'],
            queueRevision: 4,
            defaultRevision: 7,
            workingCopyRevision: 2,
          },
        },
      })
      .mockResolvedValueOnce({ mergeDocsQueueCopy: { queueRevision: 5, conflict: null } })
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.mergeDefault())
    expect(view.result.current.mergeConflict?.fields).toEqual(['TITLE'])
    await act(async () => view.result.current.mergeDefault([{ field: 'TITLE', side: 'SOURCE' }]))
    expect(mocks.request).toHaveBeenLastCalledWith(
      S.mergeDocsQueueCopy,
      expect.objectContaining({
        queueRevision: 4,
        defaultRevision: 7,
        workingCopyRevision: 2,
        choices: [{ field: 'TITLE', side: 'SOURCE' }],
      }),
    )
    expect(view.result.current.mergeConflict).toBeNull()
  })

  it('does not merge while the editor has unsaved changes', async () => {
    mocks.queue.articles = [{ articleId: 'doc', workingCopyId: 'copy', revision: 2, title: 'Doc' }]
    mocks.dirty = true
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.mergeDefault())
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('discards conflict choices when the queue revision changed', async () => {
    mocks.queue.articles = [{ articleId: 'doc', workingCopyId: 'copy', revision: 2, title: 'Doc' }]
    mocks.request.mockResolvedValueOnce({
      mergeDocsQueueCopy: {
        conflict: {
          fields: ['TITLE'],
          queueRevision: 4,
          defaultRevision: 7,
          workingCopyRevision: 2,
        },
      },
    })
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.mergeDefault())
    mocks.queue = { ...mocks.queue, revision: 5 }
    view.rerender()
    await act(async () => view.result.current.mergeDefault([{ field: 'TITLE', side: 'SOURCE' }]))
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(view.result.current.mergeConflict).toBeNull()
  })

  it('does not reload over edits made while the queue is publishing', async () => {
    mocks.queue.articles = [{ articleId: 'doc', workingCopyId: 'copy', revision: 1, title: 'Doc' }]
    let finish: (() => void) | undefined
    mocks.request.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve({})
      }),
    )
    const view = renderHook(() => usePublishQueue())
    let publishing: Promise<void>
    act(() => {
      publishing = view.result.current.release()
    })
    mocks.dirty = true
    view.rerender()
    await act(async () => {
      finish?.()
      await publishing
    })
    expect(mocks.reloadDocDraft).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation before discarding Queue-only edits', async () => {
    mocks.queue.articles = [{ articleId: 'doc', workingCopyId: 'copy', revision: 2, title: 'Doc' }]
    const proof = { formatVersion: 1, hash: 'confirmation-hash' }
    mocks.request.mockResolvedValueOnce({
      docsDequeuePreview: { requiresConfirmation: true, confirmation: proof },
    })
    const view = renderHook(() => usePublishQueue())
    await act(async () => view.result.current.prepareDequeue('doc'))
    expect(view.result.current.pendingDequeue).toMatchObject({
      articleId: 'doc',
      queueRevision: 4,
      confirmation: proof,
    })
    expect(mocks.request).toHaveBeenCalledTimes(1)
    await act(async () => view.result.current.confirmDequeue())
    expect(mocks.request).toHaveBeenLastCalledWith(
      S.dequeueDocs,
      expect.objectContaining({
        articleIds: ['doc'],
        queueRevision: 4,
        confirmation: proof,
      }),
    )
    expect(view.result.current.pendingDequeue).toBeNull()
  })
})
