import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DashboardThread/schema'

import { SIDE_TREE_CHILD_MENU_ACTION, SIDE_TREE_NODE_MENU_ACTION } from './constant'
import type { TDocTreeInitialData, TDocTreeMutationPayload, TDocTreeNodeDTO } from './spec'
import useLogic from './useLogic'

const mocks = vi.hoisted(() => ({
  createResolver: null as ((payload: TDocTreeMutationPayload) => void) | null,
  mutate: vi.fn(),
  persist: vi.fn(),
  persistCoverAction: vi.fn(),
  queryCallCount: 0,
  reload: vi.fn(),
  reloadTrash: vi.fn(),
  syncDocIdToUrl: vi.fn(),
}))

vi.mock('~/hooks/useGraphQLClient', () => ({
  default: () => ({ mutate: mocks.mutate }),
}))

vi.mock('~/hooks/useQuery', () => ({
  default: () => {
    const isTrashQuery = mocks.queryCallCount % 2 === 1
    mocks.queryCallCount += 1

    return isTrashQuery
      ? {
          data: { docTreeTrashItems: [] },
          loading: false,
          reload: mocks.reloadTrash,
        }
      : { data: null, loading: false, reload: mocks.reload }
  },
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => (key.includes('untitled') ? 'Untitled' : key) }),
}))

vi.mock('~/lib/signal', () => ({ send: vi.fn() }))
vi.mock('~/lib/slug', () => ({ slugify: async () => 'slug' }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/widgets/Toaster', () => ({ toast: vi.fn() }))
vi.mock('../helper', () => ({ reloadDocPublishChecklist: vi.fn() }))

vi.mock('./useDocEditorUrl', () => ({
  default: () => ({ currentDocId: null, syncDocIdToUrl: mocks.syncDocIdToUrl }),
}))

vi.mock('./usePersistence', () => ({
  default: () => ({
    persist: mocks.persist,
    persistCoverAction: mocks.persistCoverAction,
  }),
}))

const initialData: TDocTreeInitialData = {
  revision: 1,
  tabs: [
    {
      id: 'tab-remote',
      type: 'TAB',
      title: 'Docs',
      pins: [],
      groups: [
        {
          id: 'group-remote',
          tabId: 'tab-remote',
          type: 'GROUP',
          title: 'Guides',
          children: [],
        },
      ],
    },
  ],
}

const resolveCreateAndExpectDelete = async (node: TDocTreeNodeDTO): Promise<void> => {
  expect(mocks.createResolver).not.toBeNull()

  await act(async () => {
    mocks.createResolver?.({ revision: 2, node })
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(mocks.persist).toHaveBeenCalledWith(
      S.deleteDocTreeNode,
      { id: node.id },
      expect.any(Function),
    )
    expect(mocks.reloadTrash).toHaveBeenCalledOnce()
  })
}

describe('docs SideTree local create deletion', () => {
  beforeEach(() => {
    mocks.createResolver = null
    mocks.queryCallCount = 0
    mocks.mutate.mockReset()
    mocks.persist.mockReset()
    mocks.persistCoverAction.mockReset()
    mocks.reload.mockReset()
    mocks.reloadTrash.mockReset()
    mocks.syncDocIdToUrl.mockReset()

    mocks.persist.mockImplementation((schema) => {
      if (schema === S.deleteDocTreeNode) return Promise.resolve({ revision: 3 })

      return new Promise<TDocTreeMutationPayload>((resolve) => {
        mocks.createResolver = resolve
      })
    })
  })

  it('deletes the backend draft group when its local row is removed during create', async () => {
    const { result } = renderHook(() => useLogic(initialData))

    act(() => result.current.addGroup())
    const localId = result.current.groups.at(-1)?.id
    expect(localId).toMatch(/^local-group-/)

    act(() => result.current.renameGroup(localId!, 'New group'))
    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreeGroup,
        expect.any(Object),
        expect.any(Function),
      ),
    )

    act(() => result.current.deleteGroup(localId!))
    await resolveCreateAndExpectDelete({
      id: 'group-created',
      tabId: 'tab-remote',
      type: 'GROUP',
      title: 'New group',
      children: [],
    })

    expect(result.current.groups.some((group) => group.id === 'group-created')).toBe(false)
  })

  it('deletes the backend draft page when its local row is removed during create', async () => {
    const { result } = renderHook(() => useLogic(initialData))

    act(() => result.current.addChild('group-remote', SIDE_TREE_CHILD_MENU_ACTION.PAGE))
    const localId = result.current.groups[0].children[0]?.id
    expect(localId).toMatch(/^local-page-/)

    act(() => result.current.renameChild('group-remote', localId!, 'New page'))
    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreePage,
        expect.any(Object),
        expect.any(Function),
      ),
    )

    act(() =>
      result.current.handleChildAction('group-remote', localId!, SIDE_TREE_NODE_MENU_ACTION.DELETE),
    )
    await resolveCreateAndExpectDelete({
      id: 'page-created',
      groupId: 'group-remote',
      docId: 'doc-created',
      type: 'PAGE',
      title: 'New page',
    })

    expect(result.current.groups[0].children).toHaveLength(0)
  })

  it('deletes the backend draft link when its local row is removed during create', async () => {
    const { result } = renderHook(() => useLogic(initialData))

    act(() => result.current.addChild('group-remote', SIDE_TREE_CHILD_MENU_ACTION.LINK))
    const localId = result.current.groups[0].children[0]?.id
    expect(localId).toMatch(/^local-link-/)

    act(() =>
      result.current.renameLink('group-remote', localId!, {
        href: 'https://example.com',
        title: 'New link',
      }),
    )
    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreeLink,
        expect.any(Object),
        expect.any(Function),
      ),
    )

    act(() =>
      result.current.handleChildAction('group-remote', localId!, SIDE_TREE_NODE_MENU_ACTION.DELETE),
    )
    await resolveCreateAndExpectDelete({
      id: 'link-created',
      groupId: 'group-remote',
      type: 'LINK',
      title: 'New link',
      href: 'https://example.com',
    })

    expect(result.current.groups[0].children).toHaveLength(0)
  })

  it('deletes the backend draft pin when its local row is removed during create', async () => {
    const { result } = renderHook(() => useLogic(initialData))

    act(() => result.current.addPin())
    const localId = result.current.pins[0]?.id
    expect(localId).toMatch(/^local-pin-/)

    act(() =>
      result.current.savePin(localId!, {
        href: 'https://example.com',
        title: 'New pin',
      }),
    )
    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreePin,
        expect.any(Object),
        expect.any(Function),
      ),
    )

    act(() => result.current.deletePin(localId!))
    await resolveCreateAndExpectDelete({
      id: 'pin-created',
      tabId: 'tab-remote',
      type: 'PIN',
      title: 'New pin',
      href: 'https://example.com',
    })

    expect(result.current.pins).toHaveLength(0)
  })
})
