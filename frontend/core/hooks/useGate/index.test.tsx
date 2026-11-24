import { GATE_ACTION, type TGateAction } from '@groupher/contracts/gate'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import AccountStoreProvider from '~/stores/account/provider'

import useGate from '.'

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: vi.fn() }))

const request = vi.mocked(browserGraphQLRequest)

const wrapperFor = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AccountStoreProvider initData={{ loading: false, user: { login: 'alice' } }}>
        {children}
      </AccountStoreProvider>
    </QueryClientProvider>
  )
}

describe('useGate', () => {
  beforeEach(() => request.mockReset())

  it('denies while Passport facts are loading, then uses server-owned Global facts', async () => {
    request.mockResolvedValue({
      currentGlobalPassport: {
        isRoot: false,
        permissions: ['COMMUNITY_APPLICATION_REVIEW'],
      },
    } as never)
    const { result } = renderHook(() => useGate(), { wrapper: wrapperFor() })

    expect(result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_REVIEW)).toBe(false)
    await waitFor(() =>
      expect(result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_REVIEW)).toBe(true),
    )
    expect(result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_APPROVE)).toBe(false)
  })

  it('uses current Community Admin permission facts', async () => {
    request
      .mockImplementationOnce(
        () =>
          Promise.resolve({ currentGlobalPassport: { isRoot: false, permissions: [] } }) as never,
      )
      .mockImplementationOnce(
        () =>
          Promise.resolve({
            currentCommunityAdmin: {
              isLord: false,
              permissions: ['DOC_QUEUE_PUBLISH'],
            },
          }) as never,
      )
    const context = { scope: 'community' as const, community: 'home' }
    const { result } = renderHook(
      () => useGate({ community: { slug: 'home', ref: 'community-ref' } }),
      { wrapper: wrapperFor() },
    )

    await waitFor(() =>
      expect(result.current.can(GATE_ACTION.DOC_QUEUE_PUBLISH, context)).toBe(true),
    )
    expect(result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_APPROVE, context)).toBe(false)
  })

  it('lets the current Global root act in a Community scope', async () => {
    request
      .mockImplementationOnce(
        () =>
          Promise.resolve({ currentGlobalPassport: { isRoot: true, permissions: [] } }) as never,
      )
      .mockImplementationOnce(() => Promise.resolve({ currentCommunityAdmin: null }) as never)
    const { result } = renderHook(
      () => useGate({ community: { slug: 'home', ref: 'community-ref' } }),
      { wrapper: wrapperFor() },
    )

    await waitFor(() =>
      expect(
        result.current.can(GATE_ACTION.DOC_QUEUE_PUBLISH, {
          scope: 'community',
          community: 'home',
        }),
      ).toBe(true),
    )
  })

  it('uses generated permission keys, thread requirements, and Article context facts', async () => {
    request.mockResolvedValue({
      currentGlobalPassport: { isRoot: false, permissions: [] },
    } as never)
    const { result } = renderHook(() => useGate(), { wrapper: wrapperFor() })
    const reviewer = {
      scope: 'community' as const,
      community: 'home',
      thread: 'post' as const,
    }

    expect(
      result.current.can(GATE_ACTION.ARTICLE_UPDATE, {
        scope: 'article',
        article: {
          permissions: {
            [GATE_ACTION.ARTICLE_UPDATE]: true,
            [GATE_ACTION.ARTICLE_READ_DRAFT]: true,
          },
        },
      }),
    ).toBe(true)
    expect(
      result.current.can('bad.action' as TGateAction, {
        scope: 'article',
        article: { permissions: {} },
      }),
    ).toBe(false)
    expect(result.current.can(GATE_ACTION.DOC_QUEUE_PUBLISH, reviewer)).toBe(false)
  })
})
