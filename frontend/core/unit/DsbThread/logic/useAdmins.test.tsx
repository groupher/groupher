import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import useAdmins from './useAdmins'

const state = vi.hoisted(() => ({
  slug: 'first',
  account: 'owner',
  request: vi.fn(),
  patch: vi.fn(),
}))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/query', () => ({ viewerQueryKeys: { all: ['viewer'] } }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: state.slug }) }))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: state.account }) }))
vi.mock('~/stores/dsbEditorUi/hooks', () => ({
  useModeratorEditorUi: () => ({ activeModerator: null, patch: state.patch }),
}))
vi.mock('~/query/mutation/optimistic/execute', () => ({
  executeCommand: ({ request, variables }: any) => request(variables),
}))
const page = (id: string, number = 1) => ({
  entries: [{ id, isRoot: false, passportItemCount: 2, user: { login: id } }],
  pageInfo: {
    __typename: 'OffsetPageInfo',
    page: number,
    size: 20,
    totalCount: 40,
    totalPages: 2,
    hasNextPage: number === 1,
    hasPreviousPage: number === 2,
  },
})
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children)
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  state.slug = 'first'
  state.account = 'owner'
  state.request.mockReset()
  state.request.mockImplementation((_doc, args) =>
    Promise.resolve({
      pagedCommunityModerators: page(
        `${args.community}-${args.pagi?.offset.page}`,
        args.pagi?.offset.page,
      ),
    }),
  )
})
it('pages canonical memberships without per-user permission requests and invalidates after adding', async () => {
  const { result } = renderHook(() => useAdmins(), { wrapper })
  await waitFor(() => expect(result.current.moderators[0]?.user.login).toBe('first-1'))
  expect(state.request).toHaveBeenCalledTimes(1)
  act(() => result.current.setPage(2))
  await waitFor(() => expect(result.current.moderators[0]?.user.login).toBe('first-2'))
  expect(state.request.mock.calls[1][1]).toEqual({
    community: 'first',
    pagi: { offset: { page: 2, size: 20 } },
  })
  state.request.mockImplementation((_doc, args) =>
    args.users
      ? Promise.resolve({ addModerators: { slug: 'first' } })
      : Promise.resolve({ pagedCommunityModerators: page('after-add', 2) }),
  )
  await act(async () => {
    await result.current.addAdmins([{ login: 'new' } as never])
  })
  await waitFor(() => expect(result.current.moderators[0]?.user.login).toBe('after-add'))
})
it('resets position and isolates a late response after changing the community', async () => {
  let resolve!: (value: unknown) => void
  state.request.mockImplementationOnce(
    () =>
      new Promise((yes) => {
        resolve = yes
      }),
  )
  const { result, rerender } = renderHook(() => useAdmins(), { wrapper })
  state.slug = 'second'
  rerender()
  await waitFor(() => expect(result.current.moderators[0]?.user.login).toBe('second-1'))
  await act(async () => {
    resolve({ pagedCommunityModerators: page('old') })
  })
  expect(result.current.moderators[0]?.user.login).toBe('second-1')
  expect(state.request.mock.calls[1][1].pagi).toEqual({ offset: { page: 1, size: 20 } })
})
