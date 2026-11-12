import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/docs'

import { SIDE_TREE_CHILD_MENU_ACTION } from './constant'
import type { TDocTreeInitialData } from './spec'
import useLogic from './useLogic'

const mocks = vi.hoisted(() => ({ request: vi.fn(), reload: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.request }))
vi.mock('@tanstack/react-query', async () => ({
  ...(await vi.importActual('@tanstack/react-query')),
  useQuery: () => ({ data: null, refetch: mocks.reload, isFetching: false }),
}))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: () => 'Untitled' }) }))
vi.mock('~/lib/signal', () => ({ send: vi.fn() }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
vi.mock('../helper', () => ({ reloadDocsPublishQueue: vi.fn() }))
vi.mock('../store/hooks', () => ({ default: () => ({ saveStatus: 'saved' }) }))
vi.mock('./useDocEditorUrl', () => ({
  default: () => ({ currentDocId: null, syncDocIdToUrl: vi.fn() }),
}))
vi.mock('./usePersistence', () => ({
  default: () => ({ persist: vi.fn(), persistCoverAction: vi.fn() }),
}))

const initial: TDocTreeInitialData = {
  revision: 2,
  tabs: [
    {
      id: 'tab',
      type: 'TAB',
      title: 'Docs',
      groups: [{ id: 'group', parentNodeId: 'tab', type: 'GROUP', title: 'Group', pages: [] }],
      pins: [],
    },
  ],
}

describe('workspace page creation', () => {
  it('creates a Page with its default copy identity and advances the tree revision', async () => {
    mocks.request.mockResolvedValue({
      createDocsWorkspaceNode: {
        nodeId: 'page',
        articleId: 'article',
        workingCopyId: 'copy',
        treeRevision: 3,
      },
    })
    const view = renderHook(() => useLogic(initial))
    act(() => view.result.current.addChild('group', SIDE_TREE_CHILD_MENU_ACTION.PAGE))
    const localId = view.result.current.groups[0].pages[0].id
    act(() => view.result.current.renameChild('group', localId, 'Intro'))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        S.createDocsWorkspaceNode,
        expect.objectContaining({
          community: 'home',
          treeRevision: 2,
          parentNodeId: 'group',
          input: expect.objectContaining({ type: 'PAGE', title: 'Intro' }),
        }),
      ),
    )
    await waitFor(() =>
      expect(view.result.current.groups[0].pages[0]).toMatchObject({
        id: 'page',
        docId: 'article',
        workingCopyId: 'copy',
        workingCopyRevision: 1,
      }),
    )
  })
})
