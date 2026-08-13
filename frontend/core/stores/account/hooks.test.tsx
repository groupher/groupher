import { GROUPHER_AUTH_SIGNED_IN_COOKIE } from '@groupher/contracts/auth'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'

import useQuery from '~/hooks/useQuery'
import type { TUser } from '~/spec'

import useAccount from './hooks'
import Provider from './provider'

vi.mock('~/hooks/useQuery', () => ({
  default: vi.fn(),
}))

const mockedUseQuery = vi.mocked(useQuery)

const sessionUser: TUser = {
  avatar: 'https://static.groupher.com/icons/cmd/alien_user3.svg',
  login: 'e2e',
  nickname: 'E2E User',
}

const wrapper = ({ children }: { children: ReactNode }) => <Provider>{children}</Provider>

describe('stores/account/hooks', () => {
  beforeEach(() => {
    document.cookie = `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1; Path=/`
    mockedUseQuery.mockReset()
    mockedUseQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      loading: true,
      reload: vi.fn(),
    })
  })

  afterEach(() => {
    document.cookie = `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=; Max-Age=0; Path=/`
  })

  it('keeps the resolved user after the session probe finishes loading', async () => {
    const { result, rerender } = renderHook(() => useAccount(), { wrapper })

    mockedUseQuery.mockReturnValue({
      data: { sessionState: { isValid: true, user: sessionUser } },
      error: undefined,
      loading: false,
      reload: vi.fn(),
    })

    act(() => rerender())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.user?.login).toBe('e2e')
    })

    // The next render changes `store.loading` to false and must not erase the
    // user that was just returned by sessionState.
    act(() => rerender())

    expect(result.current.isLogin).toBe(true)
    expect(result.current.user?.login).toBe('e2e')
  })
})
