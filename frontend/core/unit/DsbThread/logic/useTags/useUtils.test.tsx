import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import { FIELDS } from '~/constant/dsb-fields'
import { articleQueryKeys } from '~/query/key'
import type { TTagGroup, TDsb } from '~/spec'
import DsbShellProvider from '~/stores/dsbShell/provider'
import { demoTagGroupsQueryKey, readDemoTagGroups } from '~/unit/DsbThread/Tags/store/demo'
import useTagsEditor from '~/unit/DsbThread/Tags/store/hooks'
import TagsEditorProvider from '~/unit/DsbThread/Tags/store/provider'

import useUtils from './useUtils'

const mocks = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.browserGraphQLRequest }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/utils/slug', () => ({
  slugify: async (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
}))

describe('useUtils Demo adapter', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mocks.browserGraphQLRequest.mockReset()
  })

  it('writes tag groups and tags into an isolated local Query scope', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const initialData = { ...FIELDS } as TDsb
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <DsbShellProvider community='home' demoMode initialData={initialData}>
          <TagsEditorProvider>{children}</TagsEditorProvider>
        </DsbShellProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useUtils([], THREAD.POST), { wrapper })

    await act(async () => result.current.createGroup('Local group'))

    const localKey = demoTagGroupsQueryKey('home', THREAD.POST)
    const localGroups = client.getQueryData<TTagGroup[]>(localKey) ?? []
    expect(localGroups).toHaveLength(1)
    expect(localGroups[0].title).toBe('Local group')
    expect(client.getQueryData(articleQueryKeys.tagGroups('home', THREAD.POST))).toBeUndefined()
    expect(readDemoTagGroups('home', THREAD.POST)).toEqual(localGroups)

    await act(async () => result.current.createTag('Local tag', localGroups[0].id))

    expect(client.getQueryData<TTagGroup[]>(localKey)?.[0].tags).toMatchObject([
      { title: 'Local tag', slug: 'local-tag', groupId: localGroups[0].id },
    ])
    expect(mocks.browserGraphQLRequest).not.toHaveBeenCalled()
  })

  it('keeps a changed sorting draft available after a failed save', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const initialData = { ...FIELDS } as TDsb
    const groups: TTagGroup[] = [
      { id: 'group-a', title: 'A', index: 0, tags: [] },
      { id: 'group-b', title: 'B', index: 1, tags: [] },
    ]
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <DsbShellProvider community='home' demoMode={false} initialData={initialData}>
          <TagsEditorProvider>{children}</TagsEditorProvider>
        </DsbShellProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(
      () => ({ ...useUtils(groups, THREAD.POST), editor: useTagsEditor() }),
      { wrapper },
    )
    mocks.browserGraphQLRequest.mockRejectedValue(new Error('sorting failed'))

    act(() => {
      result.current.editor.store.syncConfirmedOrder(THREAD.POST, groups)
      result.current.commitTagSorting(
        groups.toReversed().map((group, index) => ({ ...group, index })),
      )
    })
    await act(async () => {
      await expect(result.current.saveTagSorting(groups)).rejects.toThrow('sorting failed')
    })

    expect(result.current.hasSortingChanges).toBe(true)
  })
})
