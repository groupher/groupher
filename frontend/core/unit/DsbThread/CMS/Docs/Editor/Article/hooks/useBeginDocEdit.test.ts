import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/docs'

import useBeginDocEdit from './useBeginDocEdit'
import type { TDraftEditorState } from './useDraftEditorState'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  applyLoaded: vi.fn(),
  error: vi.fn(),
  reload: vi.fn(),
}))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('../../store/hooks', () => ({ default: () => ({ reloadSideTree: mocks.reload }) }))
vi.mock('~/query/mutation/optimistic/execute', () => ({
  executeCommand: ({
    request,
    variables,
  }: {
    request: (input: Record<string, unknown>) => Promise<unknown>
    variables: Record<string, unknown>
  }) => request({ ...variables, commandId: 'command' }),
}))
const state = () =>
  ({
    activePage: { id: 'page', docId: 'doc' },
    workingCopyId: null,
    publicSnapshotId: 'snapshot',
    dirty: false,
    applyLoaded: mocks.applyLoaded,
    setLoadError: mocks.error,
  }) as unknown as TDraftEditorState

describe('explicit Doc editing initialization', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
  })
  it('does not write on mount; explicit action creates D then loads its actual identity', async () => {
    mocks.request
      .mockResolvedValueOnce({ beginDocsEdit: { workingCopyId: 'new', revision: 1 } })
      .mockResolvedValueOnce({
        docsEditor: {
          workingCopy: {
            id: 'new',
            articleId: 'doc',
            scopeKind: 'default',
            revision: 1,
            title: 'Public',
            bodyJson: '[]',
          },
        },
      })
    const view = renderHook(() => useBeginDocEdit(state()))
    expect(mocks.request).not.toHaveBeenCalled()
    await act(() => view.result.current.beginEdit())
    expect(mocks.request.mock.calls[0][0]).toBe(S.beginDocsEdit)
    expect(mocks.request.mock.calls[0][1]).toMatchObject({
      publicSnapshotId: 'snapshot',
      articleId: 'doc',
    })
    expect(mocks.applyLoaded).toHaveBeenCalledWith(
      expect.objectContaining({ workingCopyId: 'new', version: 1 }),
    )
  })
  it.each([{ dirty: true }, { publicSnapshotId: 'new-public' }])(
    'ignores stale initialization after editor changes: %o',
    async (patch) => {
      let resolve: (value: unknown) => void = () => {}
      mocks.request
        .mockImplementationOnce(
          () =>
            new Promise((r) => {
              resolve = r
            }),
        )
        .mockResolvedValueOnce({
          docsEditor: {
            workingCopy: {
              id: 'new',
              articleId: 'doc',
              revision: 1,
              title: 'Public',
              bodyJson: '[]',
            },
          },
        })
      const current = state()
      const view = renderHook(({ value }) => useBeginDocEdit(value), {
        initialProps: { value: current },
      })
      let pending: Promise<void>
      act(() => {
        pending = view.result.current.beginEdit()
      })
      view.rerender({ value: { ...current, ...patch } })
      await act(async () => {
        resolve({ beginDocsEdit: { workingCopyId: 'new', revision: 1 } })
        await pending
      })
      expect(mocks.applyLoaded).not.toHaveBeenCalled()
    },
  )
})
