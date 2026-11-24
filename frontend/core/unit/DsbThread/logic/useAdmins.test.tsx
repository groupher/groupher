import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

import useAdmins from './useAdmins'

const state = vi.hoisted(() => ({
  slug: 'first',
  ref: 'cm_first',
  account: 'owner',
  request: vi.fn(),
  patch: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: state.request }))
vi.mock('~/query', () => ({ viewerQueryKeys: { all: ['viewer'] } }))
vi.mock('~/query/invalidation', () => ({ invalidatePrefix: vi.fn() }))
vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: state.slug, ref: state.ref }),
}))
vi.mock('~/stores/dsbShell/editor', () => ({
  useAdminEditor: () => ({ activeAdmin: null, setActiveAdmin: state.patch }),
}))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({
    accountScope: state.account,
    user: { login: 'owner' },
    refreshSession: state.refresh,
  }),
}))
vi.mock('~/query/mutation/optimistic/execute', () => ({
  executeCommand: ({ request, variables }: any) =>
    request({ ...variables, commandId: 'command-1' }),
}))
const page = (memberId: string, number = 1) => ({
  entries: [
    {
      memberId,
      revision: 3,
      isLord: false,
      permissions: ['AUDIT_READ'],
      user: { login: memberId },
    },
  ],
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
  state.ref = 'cm_first'
  state.account = 'owner'
  state.request.mockReset()
  state.patch.mockReset()
  state.refresh.mockReset()
  state.request.mockImplementation((_doc, args) =>
    Promise.resolve({
      pagedCommunityAdmins: page(`${state.slug}-${args.pagi?.offset.page}`, args.pagi?.offset.page),
    }),
  )
})
it('loads typed Admin memberships and sends memberId, revision, permissions and command id', async () => {
  const { result } = renderHook(() => useAdmins(), { wrapper })
  await waitFor(() => expect(result.current.admins[0]?.user.login).toBe('first-1'))
  expect(result.current.admins[0]?.permissions).toEqual(['audit.read'])
  expect(state.request).toHaveBeenCalledTimes(1)
  act(() => result.current.setPage(2))
  await waitFor(() => expect(result.current.admins[0]?.user.login).toBe('first-2'))
  expect(state.request.mock.calls[1][1]).toEqual({
    communityRef: 'cm_first',
    pagi: { offset: { page: 2, size: 20 } },
  })
  state.request.mockImplementation((_doc, args) =>
    Promise.resolve({ updateCommunityAdminPermissions: args }),
  )
  await act(async () => {
    await result.current.updatePermissions('member-1', 8, { ARTICLE_UPDATE: true })
  })
  expect(state.request.mock.calls[2][1]).toMatchObject({
    communityRef: 'cm_first',
    memberId: 'member-1',
    revision: 8,
    permissions: '{"ARTICLE_UPDATE":true}',
    commandId: expect.any(String),
  })
})
it('creates an invitation per selected login with the selected permission map', async () => {
  const { result } = renderHook(() => useAdmins(), { wrapper })
  state.request.mockImplementation((_doc, args) =>
    args?.subjectLogin
      ? Promise.resolve({ createCommunityAdminRequest: { status: 'pending' } })
      : Promise.resolve({ pagedCommunityAdmins: page('first-1') }),
  )
  await act(async () => {
    await result.current.addAdmins(
      [{ login: 'new-a' }, { login: 'new-b' }, { login: 'new-a' }] as never,
      { 'audit.read': true },
    )
  })
  const requests = state.request.mock.calls.filter(([, args]) => args?.subjectLogin)
  expect(requests).toHaveLength(2)
  expect(requests.map(([, args]) => args.subjectLogin).sort()).toEqual(['new-a', 'new-b'])
  expect(requests[0][1]).toMatchObject({
    communityRef: 'cm_first',
    type: 'invite',
    permissions: { 'audit.read': true },
    commandId: expect.any(String),
  })
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
  state.ref = 'cm_second'
  rerender()
  await waitFor(() => expect(result.current.admins[0]?.user.login).toBe('second-1'))
  await act(async () => {
    resolve({ pagedCommunityAdmins: page('old') })
  })
  expect(result.current.admins[0]?.user.login).toBe('second-1')
  expect(state.request.mock.calls[1][1].pagi).toEqual({ offset: { page: 1, size: 20 } })
})
