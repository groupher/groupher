import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import AccountSessionDrawer from '.'

const state = vi.hoisted(() => ({
  list: vi.fn(),
  revoke: vi.fn(),
  others: vi.fn(),
  accountScope: 'account-a',
}))
vi.mock('~/auth', () => ({
  listSessions: state.list,
  revokeSession: state.revoke,
  revokeOtherSessions: state.others,
}))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ accountScope: state.accountScope }) }))
vi.mock('~/ui/Drawer', () => ({
  default: ({ children, show }) => (show ? <div>{children}</div> : null),
}))
vi.mock('~/ui/Pagi', () => ({
  default: ({ pageInfo, onChange }) =>
    pageInfo?.hasNextPage ? (
      <button type='button' onClick={() => onChange(pageInfo.page + 1)}>
        Next devices
      </button>
    ) : null,
}))
vi.mock('./salon', () => ({ default: () => new Proxy({}, { get: () => '' }) }))
const session = (ref: string, isCurrent = false) => ({
  publicRef: ref,
  browserFamily: ref,
  isCurrent,
})
const page = (entries: unknown[], number: number, total: number) => ({
  entries,
  pageInfo: {
    __typename: 'OffsetPageInfo',
    page: number,
    size: 20,
    totalCount: total,
    totalPages: Math.ceil(total / 20),
    hasNextPage: number * 20 < total,
    hasPreviousPage: number > 1,
  },
})
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
beforeEach(() => {
  vi.clearAllMocks()
  state.accountScope = 'account-a'
})
it('uses the global total to keep revoke-others available on a page containing only the current device', async () => {
  let revoked = false
  state.list.mockImplementation(async (input) =>
    revoked
      ? page(input.offset.page === 1 ? [session('current', true)] : [], input.offset.page, 1)
      : input.offset.page === 1
        ? page([session('other')], 1, 21)
        : page([session('current', true)], 2, 21),
  )
  state.others.mockImplementation(async () => {
    revoked = true
  })
  render(
    <QueryClientProvider client={client()}>
      <AccountSessionDrawer show onClose={() => {}} />
    </QueryClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Next devices' }))
  await screen.findByText('current')
  const action = screen.getByRole('button', { name: 'Revoke other devices' })
  expect(action).toBeEnabled()
  expect(state.list).toHaveBeenCalledWith({ offset: { page: 2, size: 20 } })
  fireEvent.click(action)
  await waitFor(() => expect(state.others).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(state.list).toHaveBeenLastCalledWith({ offset: { page: 1, size: 20 } }),
  )
  expect(await screen.findByText('current')).toBeInTheDocument()
})
it('isolates device pages across accounts even when an old request resolves late', async () => {
  let resolveOld!: (value: unknown) => void
  state.list.mockImplementation(() =>
    state.accountScope === 'account-a'
      ? new Promise((resolve) => {
          resolveOld = resolve
        })
      : Promise.resolve(page([session('device-b', true)], 1, 1)),
  )
  const queryClient = client()
  const view = () => (
    <QueryClientProvider client={queryClient}>
      <AccountSessionDrawer show onClose={() => {}} />
    </QueryClientProvider>
  )
  const { rerender } = render(view())
  await waitFor(() => expect(state.list).toHaveBeenCalledTimes(1))
  state.accountScope = 'account-b'
  rerender(view())
  await screen.findByText('device-b')
  resolveOld(page([session('device-a', true)], 1, 1))
  await waitFor(() =>
    expect(
      queryClient.getQueryData([
        'viewer',
        'account-a',
        'sessions',
        { offset: { page: 1, size: 20 } },
      ]),
    ).toBeTruthy(),
  )
  expect(screen.queryByText('device-a')).not.toBeInTheDocument()
  expect(screen.getByText('device-b')).toBeInTheDocument()
})
