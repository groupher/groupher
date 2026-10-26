import { GROUPHER_AUTH_SIGNED_IN_COOKIE } from '@groupher/contracts/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { viewerQueryKeys } from '~/query/key'
import type { TUser } from '~/spec'

import useAccount from './hooks'
import Provider from './provider'

const sessionUser: TUser = {
  avatar: 'https://static.groupher.com/icons/cmd/alien_user3.svg',
  login: 'e2e',
  nickname: 'E2E User',
}

const wrapperFor = (queryClient: QueryClient, user: TUser | null = null) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Provider initData={{ loading: false, user }}>{children}</Provider>
    </QueryClientProvider>
  )
}

describe('stores/account/provider', () => {
  beforeEach(() => {
    document.cookie = `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1; Path=/`
  })

  afterEach(() => {
    document.cookie = `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=; Max-Age=0; Path=/`
    vi.unstubAllGlobals()
  })

  it('probes the real session query after hydration when the signed-in hint has an anonymous seed', async () => {
    const request = vi.fn().mockResolvedValue(
      Response.json({
        data: { sessionState: { isValid: true, user: sessionUser } },
      }),
    )
    vi.stubGlobal('fetch', request)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(queryClient),
    })

    await waitFor(() => expect(request).toHaveBeenCalledOnce())
    await waitFor(() => expect(result.current.user?.login).toBe('e2e'))
    expect(result.current.isLogin).toBe(true)
  })

  it('keeps a resolved SSR user without probing again', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(queryClient, sessionUser),
    })

    await waitFor(() => expect(result.current.user?.login).toBe('e2e'))
    expect(request).not.toHaveBeenCalled()
  })

  it('clears private query data when the session changes accounts', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const oldKey = viewerQueryKeys.myReports('user:e2e', 1)
    queryClient.setQueryData(oldKey, { entries: ['private'] })

    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(queryClient, sessionUser),
    })
    expect(result.current.accountScope).toBe('user:e2e')

    act(() => {
      queryClient.setQueryData(viewerQueryKeys.session(), {
        sessionState: { isValid: true, user: { ...sessionUser, login: 'another' } },
      })
    })

    await waitFor(() => expect(result.current.accountScope).toBe('user:another'))
    await waitFor(() => expect(queryClient.getQueryData(oldKey)).toBeUndefined())
  })

  it('refreshes the canonical session after the current Passport changes', async () => {
    const refreshedUser = {
      ...sessionUser,
      passport: { global: { 'community.application.review': true } },
    }
    const request = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: { sessionState: { isValid: true, user: refreshedUser } } }),
      )
    vi.stubGlobal('fetch', request)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(queryClient, sessionUser),
    })

    await act(() => result.current.refreshSession())

    await waitFor(() => expect(result.current.user?.passport).toEqual(refreshedUser.passport))
    expect(request).toHaveBeenCalledOnce()
  })

  it('keeps an anonymous browser request-free when the signed-in hint is absent', async () => {
    document.cookie = `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=; Max-Age=0; Path=/`
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(queryClient),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isLogin).toBe(false)
    expect(request).not.toHaveBeenCalled()
  })
})
