import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import S from '~/unit/DsbThread/schema/docs'

import { SIDE_TREE_CHILD_MENU_ACTION, SIDE_TREE_NODE_MENU_ACTION } from './constant'
import type { TDocTreeInitialData, TSideTreeGroup } from './spec'
import useLogic from './useLogic'

const mocks = vi.hoisted(() => ({
  resolveCreate: null as ((value: unknown) => void) | null,
  mutate: vi.fn(),
  reload: vi.fn(),
  reloadTrash: vi.fn(),
  syncDocIdToUrl: vi.fn(),
  queryCallCount: 0,
  treeQuery: {
    data: null as null | {
      docsWorkspaceTree: { treeRevision: number; queueRevision: number; nodes: unknown[] }
    },
    isFetching: false,
    refetch: vi.fn(),
  },
  trashQuery: {
    data: { communityArticleTrashItems: { entries: [], pageInfo: null } },
    isFetching: false,
    refetch: vi.fn(),
  },
  saveStatus: 'saved',
  preview: {
    requiresConfirmation: false,
    confirmation: null as null | { formatVersion: number; hash: string },
    publicCount: 0,
    draftCount: 1,
  },
}))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.mutate }))
vi.mock('~/query/mutation/optimistic/execute', () => ({
  executeCommand: ({
    request,
    variables,
  }: {
    request: (value: unknown) => unknown
    variables: object
  }) => request({ ...variables, commandId: 'command-id' }),
}))
vi.mock('@tanstack/react-query', async () => ({
  ...(await vi.importActual('@tanstack/react-query')),
  useQuery: () => {
    const slot = mocks.queryCallCount++ % 2
    return slot === 1 ? mocks.trashQuery : mocks.treeQuery
  },
}))
vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => (key.includes('untitled') ? 'Untitled' : key) }),
}))
vi.mock('~/lib/signal', () => ({ send: vi.fn() }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/ui/Toaster', () => ({ toast: vi.fn() }))
vi.mock('../helper', () => ({ reloadDocsPublishQueue: vi.fn() }))
vi.mock('../store', () => ({ deriveDocSaveStatus: () => mocks.saveStatus }))
vi.mock('../store/hooks', () => ({
  useDocsEditorStore: () => ({
    draft: {},
    savedDraft: {},
    loadStatus: {},
    draftSaveStatus: {},
  }),
}))
vi.mock('./useDocEditorUrl', () => ({
  default: () => ({ currentDocId: null, syncDocIdToUrl: mocks.syncDocIdToUrl }),
}))
vi.mock('./usePersistence', () => ({
  default: () => ({
    persist: vi.fn(),
    persistCoverAction: vi.fn(),
    persistWorkspaceUpdate: vi.fn(),
    persistWorkspaceMove: vi.fn(),
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

const resolveCreated = async (id: string, articleId?: string) => {
  await act(async () => {
    mocks.resolveCreate?.({
      createDocsWorkspaceNode: {
        nodeId: id,
        articleId: articleId ?? null,
        workingCopyId: articleId ? 'work-id' : null,
        treeRevision: 2,
      },
    })
    await Promise.resolve()
  })
}

beforeEach(() => {
  mocks.resolveCreate = null
  mocks.queryCallCount = 0
  mocks.treeQuery.data = null
  mocks.treeQuery.refetch = mocks.reload
  mocks.trashQuery.refetch = mocks.reloadTrash
  mocks.saveStatus = 'saved'
  mocks.preview = { requiresConfirmation: false, confirmation: null, publicCount: 0, draftCount: 1 }
  mocks.mutate.mockReset()
  mocks.reload.mockReset()
  mocks.reloadTrash.mockReset()
  mocks.syncDocIdToUrl.mockReset()
  mocks.mutate.mockImplementation((schema) => {
    if (schema === S.createDocsWorkspaceNode)
      return new Promise((resolve) => {
        mocks.resolveCreate = resolve
      })
    if (schema === S.docsWorkspaceTree)
      return Promise.resolve({ docsWorkspaceTree: { treeRevision: 2, queueRevision: 0 } })
    if (schema === S.docsWorkspaceDeletePreview)
      return Promise.resolve({ docsWorkspaceDeletePreview: mocks.preview })
    if (schema === S.deleteDocsWorkspaceNode)
      return Promise.resolve({ deleteDocsWorkspaceNode: { treeRevision: 3, queueRevision: 0 } })
    return Promise.reject(new Error('Unexpected request'))
  })
})

const loadRemoteGroup = (): void => {
  mocks.treeQuery.data = {
    docsWorkspaceTree: {
      treeRevision: 1,
      queueRevision: 0,
      nodes: [
        {
          nodeId: 'tab-remote',
          type: 'TAB',
          parentNodeId: null,
          index: 0,
          title: 'Docs',
          hidden: false,
          published: false,
        },
        {
          nodeId: 'group-remote',
          type: 'GROUP',
          parentNodeId: 'tab-remote',
          index: 0,
          title: 'Guides',
          hidden: false,
          published: false,
        },
      ],
    },
  }
}

describe('Docs workspace tree', () => {
  it.each([
    ['group', 'group-created'],
    ['page', 'page-created'],
    ['link', 'link-created'],
    ['pin', 'pin-created'],
  ])('deletes a %s after its in-flight creation completes', async (kind, createdId) => {
    loadRemoteGroup()
    const { result } = renderHook(() => useLogic(initialData))
    let localId: string
    if (kind === 'group') {
      act(() => result.current.addGroup())
      localId = result.current.groups[0].id
      act(() => result.current.renameGroup(localId, 'New group'))
    } else if (kind === 'pin') {
      act(() => result.current.addPin())
      localId = result.current.pins[0].id
      act(() => result.current.savePin(localId, { href: 'https://example.com', title: 'New pin' }))
    } else {
      act(() =>
        result.current.addChild(
          'group-remote',
          kind === 'page' ? SIDE_TREE_CHILD_MENU_ACTION.PAGE : SIDE_TREE_CHILD_MENU_ACTION.LINK,
        ),
      )
      localId = result.current.groups[0].pages[0].id
      if (kind === 'page')
        act(() => result.current.renameChild('group-remote', localId, 'New page'))
      else
        act(() =>
          result.current.renameLink('group-remote', localId, {
            href: 'https://example.com',
            title: 'New link',
          }),
        )
    }
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        S.createDocsWorkspaceNode,
        expect.objectContaining({
          community: 'home',
          treeRevision: 1,
          input: expect.objectContaining({ type: kind.toUpperCase() }),
        }),
      ),
    )
    if (kind === 'group') act(() => result.current.deleteGroup(localId))
    else if (kind === 'pin') act(() => result.current.deletePin(localId))
    else
      act(() =>
        result.current.handleChildAction(
          'group-remote',
          localId,
          SIDE_TREE_NODE_MENU_ACTION.DELETE,
        ),
      )
    await resolveCreated(createdId, kind === 'page' ? 'doc-created' : undefined)
    await waitFor(() => expect(result.current.deleteConfirmation).not.toBeNull())
    act(() => result.current.finishDeleteConfirmation(true))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        S.deleteDocsWorkspaceNode,
        expect.objectContaining({ nodeId: createdId, treeRevision: 2, queueRevision: 0 }),
      ),
    )
    expect(mocks.reloadTrash).toHaveBeenCalled()
  })

  it('retains the remote node when the user cancels deletion', async () => {
    loadRemoteGroup()
    const { result } = renderHook(() => useLogic(initialData))
    act(() => result.current.deleteGroup('group-remote'))
    await waitFor(() => expect(result.current.deleteConfirmation).not.toBeNull())
    act(() => result.current.finishDeleteConfirmation(false))
    expect(result.current.groups.map((group) => group.id)).toEqual(['group-remote'])
    expect(mocks.mutate).not.toHaveBeenCalledWith(S.deleteDocsWorkspaceNode, expect.anything())
  })

  it('binds an explicit confirmation to the queue revision and proof', async () => {
    loadRemoteGroup()
    mocks.preview = {
      requiresConfirmation: true,
      confirmation: { formatVersion: 1, hash: 'proof' },
      publicCount: 1,
      draftCount: 1,
    }
    const { result } = renderHook(() => useLogic(initialData))
    act(() => result.current.deleteGroup('group-remote'))
    await waitFor(() =>
      expect(result.current.deleteConfirmation).toContain('dsb.doc.queue.discard_warning'),
    )
    act(() => result.current.finishDeleteConfirmation(true))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        S.deleteDocsWorkspaceNode,
        expect.objectContaining({
          nodeId: 'group-remote',
          treeRevision: 1,
          queueRevision: 0,
          confirmation: { formatVersion: 1, hash: 'proof' },
        }),
      ),
    )
  })

  it('does not delete while the current editor has unsaved changes', async () => {
    mocks.saveStatus = 'dirty'
    const { result } = renderHook(() => useLogic(initialData))
    act(() => result.current.deleteGroup('group-remote'))
    expect(mocks.mutate).not.toHaveBeenCalledWith(S.docsWorkspaceDeletePreview, expect.anything())
    expect(result.current.groups.map((group) => group.id)).toEqual(['group-remote'])
  })

  it('places a new Group before leaf nodes and uses the new creation command', () => {
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
                  title: 'Page',
                },
              ],
            },
          ],
        },
      ],
    }
    const { result } = renderHook(() => useLogic(data))
    act(() => result.current.addNestedGroup('group-remote'))
    const localId = result.current.groups[0].pages[0].id
    act(() => result.current.renameGroup(localId, 'New nested group'))
    expect(result.current.groups[0].pages.map((node) => node.id)).toEqual([
      'nested-remote',
      localId,
      'page-remote',
    ])
    expect(mocks.mutate).toHaveBeenCalledWith(
      S.createDocsWorkspaceNode,
      expect.objectContaining({
        input: expect.objectContaining({ index: 1, type: 'GROUP' }),
        parentNodeId: 'group-remote',
      }),
    )
  })

  it('activates a Page created in a nested Group', async () => {
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
    const localId = (result.current.groups[0].pages[0] as TSideTreeGroup).pages[0].id
    act(() => result.current.renameChild('nested-remote', localId, 'Nested page'))
    await resolveCreated('nested-page-created', 'nested-doc-created')
    await waitFor(() => expect(result.current.activeId).toBe('nested-page-created'))
    expect(mocks.syncDocIdToUrl).toHaveBeenLastCalledWith('nested-doc-created')
  })

  it('creates tabs with the GraphQL enum value', async () => {
    const { result } = renderHook(() => useLogic(initialData))
    act(() => result.current.addTab())
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        S.createDocsWorkspaceNode,
        expect.objectContaining({ input: expect.objectContaining({ type: 'TAB', index: 1 }) }),
      ),
    )
  })

  it('creates a default Tab before adding a Group to an empty workspace', async () => {
    const emptyWorkspace: TDocTreeInitialData = { ...initialData, tabs: [] }
    const { result } = renderHook(() => useLogic(emptyWorkspace))

    act(() => result.current.addGroup())

    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        S.createDocsWorkspaceNode,
        expect.objectContaining({
          treeRevision: 1,
          input: expect.objectContaining({ type: 'TAB', index: 0 }),
        }),
      ),
    )

    await resolveCreated('tab-created')

    await waitFor(() => {
      expect(result.current.activeTabId).toBe('tab-created')
      expect(result.current.groups).toHaveLength(1)
    })

    const groupId = result.current.groups[0].id
    act(() => result.current.renameGroup(groupId, 'Getting started'))

    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        S.createDocsWorkspaceNode,
        expect.objectContaining({
          treeRevision: 2,
          parentNodeId: 'tab-created',
          input: expect.objectContaining({ type: 'GROUP', title: 'Getting started' }),
        }),
      ),
    )
  })
})
