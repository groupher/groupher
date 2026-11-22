import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/docs'

import useSideTreePersistence from './usePersistence'

const mocks = vi.hoisted(() => ({ request: vi.fn(), reloadQueue: vi.fn(), toast: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))
vi.mock('../helper', () => ({ reloadDocsPublishQueue: mocks.reloadQueue }))

describe('workspace node update', () => {
  it('uses the tree revision and refreshes the queue after a committed change', async () => {
    const revisionRef = { current: 4 }
    const reload = vi.fn()
    mocks.request.mockResolvedValueOnce({ updateDocsWorkspaceNode: { treeRevision: 5 } })
    const view = renderHook(() =>
      useSideTreePersistence({
        revisionRef,
        reload,
        setTreeState: vi.fn(),
        setCoverWarning: vi.fn(),
      }),
    )
    await act(async () => view.result.current.persistWorkspaceUpdate('node', { title: 'Renamed' }))
    expect(mocks.request).toHaveBeenCalledWith(
      S.updateDocsWorkspaceNode,
      expect.objectContaining({
        community: 'home',
        nodeId: 'node',
        treeRevision: 4,
        patch: { title: 'Renamed' },
        commandId: expect.any(String),
      }),
    )
    expect(revisionRef.current).toBe(5)
    expect(mocks.reloadQueue).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('moves a node with its destination and the current tree revision', async () => {
    const revisionRef = { current: 6 }
    const reload = vi.fn()
    mocks.request.mockResolvedValueOnce({ moveDocsWorkspaceNode: { treeRevision: 7 } })
    const view = renderHook(() =>
      useSideTreePersistence({
        revisionRef,
        reload,
        setTreeState: vi.fn(),
        setCoverWarning: vi.fn(),
      }),
    )
    await act(async () => view.result.current.persistWorkspaceMove('page', 'group', 2))
    expect(mocks.request).toHaveBeenLastCalledWith(
      S.moveDocsWorkspaceNode,
      expect.objectContaining({
        community: 'home',
        nodeId: 'page',
        parentNodeId: 'group',
        position: 2,
        treeRevision: 6,
      }),
    )
    expect(revisionRef.current).toBe(7)
    expect(reload).toHaveBeenCalledOnce()
  })
})
