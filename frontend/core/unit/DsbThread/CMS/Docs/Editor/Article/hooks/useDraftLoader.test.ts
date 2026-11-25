import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/docs'

import { SIDE_TREE_NODE_TYPE } from '../../SideTree/constant'
import type { TDraftEditorState } from './useDraftEditorState'
import useDraftLoader from './useDraftLoader'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  applyLoaded: vi.fn(),
  setLoadError: vi.fn(),
  setLoading: vi.fn(),
  resetDraft: vi.fn(),
  applyDraftPatch: vi.fn(),
}))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/hooks/useEvent', () => ({ default: vi.fn() }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('../../store/hooks', () => ({ useDocsEditorStore: () => ({ revisionReloadKey: 0 }) }))

describe('Docs default working copy loader', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
  })

  it('loads the authorized default copy', async () => {
    mocks.request.mockResolvedValue({
      docsEditor: {
        workingCopy: {
          id: 'default',
          articleId: 'doc',
          scopeType: 'default',
          revision: 3,
          title: 'Draft',
          bodyJson: '[]',
        },
        publicSnapshot: null,
      },
    })
    const state = {
      activePage: { id: 'page', type: SIDE_TREE_NODE_TYPE.PAGE, docId: 'doc' },
      loadStatus: { loadedDocId: null, loading: false, error: null },
      dirty: false,
      applyLoaded: mocks.applyLoaded,
      setLoadError: mocks.setLoadError,
      setLoading: mocks.setLoading,
      resetDraft: mocks.resetDraft,
      applyDraftPatch: mocks.applyDraftPatch,
    } as unknown as TDraftEditorState
    renderHook(() => useDraftLoader(state))
    await waitFor(() =>
      expect(mocks.applyLoaded).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Draft', version: 3 }),
      ),
    )
    expect(mocks.request).toHaveBeenCalledWith(
      S.docsEditor,
      { community: 'home', articleId: 'doc' },
      expect.any(Object),
    )
  })
  it('loads public content without creating a default copy', async () => {
    mocks.request.mockResolvedValue({
      docsEditor: {
        workingCopy: null,
        publicSnapshot: { id: 'snapshot', articleId: 'doc', title: 'Public', bodyJson: '[]' },
      },
    })
    const state = {
      activePage: { id: 'page', type: SIDE_TREE_NODE_TYPE.PAGE, docId: 'doc' },
      loadStatus: { loadedDocId: null, loading: false, error: null },
      dirty: false,
      applyLoaded: mocks.applyLoaded,
      setLoadError: mocks.setLoadError,
      setLoading: mocks.setLoading,
      resetDraft: mocks.resetDraft,
      applyDraftPatch: mocks.applyDraftPatch,
    } as unknown as TDraftEditorState
    renderHook(() => useDraftLoader(state))
    await waitFor(() =>
      expect(mocks.applyLoaded).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Public',
          source: 'public',
          workingCopyId: null,
          publicSnapshotId: 'snapshot',
          version: 0,
        }),
      ),
    )
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(mocks.request.mock.calls[0][0]).toBe(S.docsEditor)
  })
})
