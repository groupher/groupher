import { GATE_ACTION, type TGateAction } from '@groupher/contracts/gate'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import AccountStoreProvider from '~/stores/account/provider'

import useGate from '.'

const wrapperFor = (passport?: Record<string, unknown>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AccountStoreProvider
        initData={{ loading: false, user: { login: 'alice', passport: passport as never } }}
      >
        {children}
      </AccountStoreProvider>
    </QueryClientProvider>
  )
}

describe('useGate', () => {
  it('allows a generated global Passport action', () => {
    const { result } = renderHook(() => useGate(), {
      wrapper: wrapperFor({ global: { [GATE_ACTION.COMMUNITY_APPLICATION_REVIEW]: true } }),
    })

    expect(result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_REVIEW)).toBe(true)
    expect(result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_APPROVE)).toBe(false)
  })

  it('allows a system root and a Community lord only in their Passport scopes', () => {
    const root = renderHook(() => useGate(), {
      wrapper: wrapperFor({ global: { is_root: true } }),
    })
    const lord = renderHook(() => useGate(), {
      wrapper: wrapperFor({ global: {}, home: { is_lord: true } }),
    })

    expect(root.result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_APPROVE)).toBe(true)
    expect(
      root.result.current.can(GATE_ACTION.DOC_QUEUE_PUBLISH, {
        scope: 'community',
        community: 'docs',
      }),
    ).toBe(true)
    expect(
      lord.result.current.can(GATE_ACTION.DOC_QUEUE_PUBLISH, {
        scope: 'community',
        community: 'home',
      }),
    ).toBe(true)
    expect(lord.result.current.can(GATE_ACTION.COMMUNITY_APPLICATION_APPROVE)).toBe(false)
  })

  it('uses canonical permission keys and requirements for the actual resource thread', () => {
    const reviewer = renderHook(() => useGate(), {
      wrapper: wrapperFor({
        global: {},
        home: {
          cms: {
            [GATE_ACTION.COMMUNITY_ARTICLE_HIDE]: true,
            [GATE_ACTION.COMMUNITY_ARTICLE_TRASH_READ]: true,
          },
        },
      }),
    })

    expect(
      reviewer.result.current.can(GATE_ACTION.COMMUNITY_ARTICLE_HIDE, {
        scope: 'community',
        community: 'home',
        thread: 'post',
      }),
    ).toBe(true)
    expect(
      reviewer.result.current.can(GATE_ACTION.COMMUNITY_ARTICLE_HIDE, {
        scope: 'community',
        community: 'home',
        thread: 'doc',
      }),
    ).toBe(false)
    expect(
      reviewer.result.current.can(GATE_ACTION.COMMUNITY_ARTICLE_HIDE, {
        scope: 'community',
        community: 'home',
      }),
    ).toBe(false)
    expect(
      reviewer.result.current.can(GATE_ACTION.ARTICLE_UPDATE, {
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
      reviewer.result.current.can(GATE_ACTION.ARTICLE_UPDATE, {
        scope: 'article',
        article: { permissions: {} },
      }),
    ).toBe(false)
    expect(reviewer.result.current.can('bad.action' as TGateAction)).toBe(false)
  })
})
