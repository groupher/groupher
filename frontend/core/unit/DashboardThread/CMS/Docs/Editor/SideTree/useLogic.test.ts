import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DashboardThread/schema'

import { SIDE_TREE_CHILD_MENU_ACTION, SIDE_TREE_NODE_MENU_ACTION } from './constant'
import type {
  TDocTreeInitialData,
  TDocTreeMutationPayload,
  TDocTreeNodeDTO,
  TSideTreeGroup,
} from './spec'
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
          parentNodeId: 'tab-remote',
          type: 'GROUP',
          title: 'Guides',
          pages: [],
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
    const localId = result.current.groups[0]?.id
    expect(localId).toMatch(/^local-group-/)

    act(() => result.current.renameGroup(localId!, 'New group'))
    expect(result.current.groups.map((group) => group.id)).toEqual(['group-remote', localId])
    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreeNode,
        {
          input: { index: 1, title: 'New group', type: 'GROUP' },
          parentNodeId: 'tab-remote',
        },
        expect.any(Function),
      ),
    )

    act(() => result.current.deleteGroup(localId!))
    await resolveCreateAndExpectDelete({
      id: 'group-created',
      parentNodeId: 'tab-remote',
      type: 'GROUP',
      title: 'New group',
      pages: [],
    })

    expect(result.current.groups.some((group) => group.id === 'group-created')).toBe(false)
  })

  it('deletes the backend draft page when its local row is removed during create', async () => {
    const { result } = renderHook(() => useLogic(initialData))

    act(() => result.current.addChild('group-remote', SIDE_TREE_CHILD_MENU_ACTION.PAGE))
    const localId = result.current.groups[0].pages[0]?.id
    expect(localId).toMatch(/^local-page-/)

    act(() => result.current.renameChild('group-remote', localId!, 'New page'))
    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreeNode,
        {
          input: {
            href: undefined,
            index: 0,
            marker: expect.any(Object),
            title: 'New page',
            type: 'PAGE',
          },
          parentNodeId: 'group-remote',
        },
        expect.any(Function),
      ),
    )

    act(() =>
      result.current.handleChildAction('group-remote', localId!, SIDE_TREE_NODE_MENU_ACTION.DELETE),
    )
    await resolveCreateAndExpectDelete({
      id: 'page-created',
      parentNodeId: 'group-remote',
      docId: 'doc-created',
      type: 'PAGE',
      title: 'New page',
    })

    expect(result.current.groups[0].pages).toHaveLength(0)
  })

  it('moves a confirmed nested Group to the end of its Group lane', () => {
    const data: TDocTreeInitialData = {
      ...initialData,
      tabs: [
        {
          ...initialData.tabs[0],
          groups: [
            {
              ...initialData.tabs[0].groups![0],
              pages: [
                {
                  id: 'nested-remote',
                  parentNodeId: 'group-remote',
                  type: 'GROUP',
                  title: 'Nested',
                  pages: [],
                },
                {
                  id: 'page-remote',
                  parentNodeId: 'group-remote',
                  docId: 'doc-remote',
                  type: 'PAGE',
                  title: 'Existing page',
                },
              ],
            },
          ],
        },
      ],
    }
    const { result } = renderHook(() => useLogic(data))

    act(() => result.current.addNestedGroup('group-remote'))
    const localId = result.current.groups[0].pages[0]?.id
    expect(result.current.groups[0].pages.map((node) => node.id)).toEqual([
      localId,
      'nested-remote',
      'page-remote',
    ])

    act(() => result.current.renameGroup(localId!, 'New nested group'))

    expect(result.current.groups[0].pages.map((node) => node.id)).toEqual([
      'nested-remote',
      localId,
      'page-remote',
    ])
    expect(mocks.persist).toHaveBeenCalledWith(
      S.createDocTreeNode,
      expect.objectContaining({
        input: expect.objectContaining({ index: 1, type: 'GROUP' }),
        parentNodeId: 'group-remote',
      }),
      expect.any(Function),
    )
  })

  it('creates Groups first and moves a confirmed Page to the end of the leaf lane', () => {
    const data: TDocTreeInitialData = {
      ...initialData,
      tabs: [
        {
          ...initialData.tabs[0],
          groups: [
            {
              ...initialData.tabs[0].groups![0],
              pages: [
                {
                  id: 'nested-remote',
                  parentNodeId: 'group-remote',
                  type: 'GROUP',
                  title: 'Nested',
                  pages: [],
                },
                {
                  id: 'page-remote',
                  parentNodeId: 'group-remote',
                  docId: 'doc-remote',
                  type: 'PAGE',
                  title: 'Existing page',
                },
              ],
            },
          ],
        },
      ],
    }
    const { result } = renderHook(() => useLogic(data))

    act(() => result.current.addChild('group-remote', SIDE_TREE_CHILD_MENU_ACTION.PAGE))
    const localId = result.current.groups[0].pages[1]?.id
    expect(result.current.groups[0].pages.map((node) => node.id)).toEqual([
      'nested-remote',
      localId,
      'page-remote',
    ])

    act(() => result.current.renameChild('group-remote', localId!, 'New page'))

    expect(result.current.groups[0].pages.map((node) => node.id)).toEqual([
      'nested-remote',
      'page-remote',
      localId,
    ])
    expect(mocks.persist).toHaveBeenCalledWith(
      S.createDocTreeNode,
      expect.objectContaining({
        input: expect.objectContaining({ index: 2, type: 'PAGE' }),
        parentNodeId: 'group-remote',
      }),
      expect.any(Function),
    )
  })

  it('persists and activates a Page created inside a nested Group', async () => {
    const data: TDocTreeInitialData = {
      ...initialData,
      tabs: [
        {
          ...initialData.tabs[0],
          groups: [
            {
              ...initialData.tabs[0].groups![0],
              pages: [
                {
                  id: 'nested-remote',
                  parentNodeId: 'group-remote',
                  type: 'GROUP',
                  title: 'Nested',
                  pages: [],
                },
              ],
            },
          ],
        },
      ],
    }
    const { result } = renderHook(() => useLogic(data))

    act(() => result.current.addChild('nested-remote', SIDE_TREE_CHILD_MENU_ACTION.PAGE))
    const nestedGroup = result.current.groups[0].pages[0] as TSideTreeGroup
    const localId = nestedGroup.pages[0]?.id
    expect(localId).toMatch(/^local-page-/)

    act(() => result.current.renameChild('nested-remote', localId!, 'Nested page'))

    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreeNode,
        {
          input: {
            href: undefined,
            index: 0,
            marker: expect.any(Object),
            title: 'Nested page',
            type: 'PAGE',
          },
          parentNodeId: 'nested-remote',
        },
        expect.any(Function),
      ),
    )

    await act(async () => {
      mocks.createResolver?.({
        revision: 2,
        node: {
          id: 'nested-page-created',
          parentNodeId: 'nested-remote',
          docId: 'nested-doc-created',
          type: 'PAGE',
          title: 'Nested page',
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.activeId).toBe('nested-page-created')
      expect(mocks.syncDocIdToUrl).toHaveBeenLastCalledWith('nested-doc-created')
    })
  })

  it('deletes the backend draft link when its local row is removed during create', async () => {
    const { result } = renderHook(() => useLogic(initialData))

    act(() => result.current.addChild('group-remote', SIDE_TREE_CHILD_MENU_ACTION.LINK))
    const localId = result.current.groups[0].pages[0]?.id
    expect(localId).toMatch(/^local-link-/)

    act(() =>
      result.current.renameLink('group-remote', localId!, {
        href: 'https://example.com',
        title: 'New link',
      }),
    )
    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreeNode,
        {
          input: {
            href: 'https://example.com',
            index: 0,
            marker: expect.any(Object),
            title: 'New link',
            type: 'LINK',
          },
          parentNodeId: 'group-remote',
        },
        expect.any(Function),
      ),
    )

    act(() =>
      result.current.handleChildAction('group-remote', localId!, SIDE_TREE_NODE_MENU_ACTION.DELETE),
    )
    await resolveCreateAndExpectDelete({
      id: 'link-created',
      parentNodeId: 'group-remote',
      type: 'LINK',
      title: 'New link',
      href: 'https://example.com',
    })

    expect(result.current.groups[0].pages).toHaveLength(0)
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
        S.createDocTreeNode,
        {
          input: {
            href: 'https://example.com',
            index: 0,
            marker: expect.any(Object),
            title: 'New pin',
            type: 'PIN',
          },
          parentNodeId: 'tab-remote',
        },
        expect.any(Function),
      ),
    )

    act(() => result.current.deletePin(localId!))
    await resolveCreateAndExpectDelete({
      id: 'pin-created',
      parentNodeId: 'tab-remote',
      type: 'PIN',
      title: 'New pin',
      href: 'https://example.com',
    })

    expect(result.current.pins).toHaveLength(0)
  })

  it('serializes a new tab with the GraphQL enum wire value', async () => {
    const { result } = renderHook(() => useLogic(initialData))

    act(() => result.current.addTab())

    await waitFor(() =>
      expect(mocks.persist).toHaveBeenCalledWith(
        S.createDocTreeNode,
        { input: { index: 1, title: 'Untitled', type: 'TAB' } },
        expect.any(Function),
      ),
    )
  })
})
