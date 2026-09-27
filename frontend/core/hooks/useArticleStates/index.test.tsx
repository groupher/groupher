import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import { articleKeys, viewerKeys } from '~/query'
import { readArticleViewAck, writeArticleViewAck } from '~/query/viewAck'
import type { TArticle, TArticleStats } from '~/spec'
import AccountStoreProvider from '~/stores/account/provider'

import useArticleStates from '.'

const article = {
  innerId: '42',
  community: { slug: 'home' },
  meta: { thread: THREAD.POST },
} as TArticle

const stats = (views: number, overrides: Partial<TArticleStats> = {}): TArticleStats => ({
  community: 'home',
  thread: THREAD.POST,
  innerId: '42',
  views,
  viewsRevision: views,
  upvotesCount: 0,
  commentsCount: 0,
  collectsCount: 0,
  commentsParticipantsCount: 0,
  interactionRevision: 0,
  commentsRevision: 0,
  emotionCounts: [],
  snapshotAt: new Date().toISOString(),
  ...overrides,
})

const wrapperFor = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AccountStoreProvider initData={{ loading: false, user: null }}>
        {children}
      </AccountStoreProvider>
    </QueryClientProvider>
  )
}

describe('useArticleStates', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('uses entity stats and applies one shared view acknowledgement overlay', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    const key = 'home:POST:42'
    queryClient.setQueryData(articleKeys.statsBatch('home', THREAD.POST, ['42']), [stats(3)])
    queryClient.setQueryData(articleKeys.stats('home', THREAD.POST, '42'), stats(4))
    queryClient.setQueryData(viewerKeys.articleStates('', [key]), {
      [key]: { articleKey: key, viewerHasViewed: false },
    })
    writeArticleViewAck(key)

    const { result } = renderHook(() => useArticleStates([article]), {
      wrapper: wrapperFor(queryClient),
    })

    expect(result.current[0]?.stats?.views).toBe(4)
    expect(result.current[0]?.viewerState.viewerHasViewed).toBe(true)

    act(() => {
      queryClient.setQueryData(viewerKeys.articleStates('', [key]), {
        [key]: { articleKey: key, viewerHasViewed: true },
      })
    })

    await waitFor(() => expect(readArticleViewAck(key)).toBeNull())
  })

  it('groups multiple batches while preserving input order and entity precedence', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    const second = {
      innerId: '7',
      community: { slug: 'home' },
      meta: { thread: THREAD.POST },
    } as TArticle
    const third = {
      innerId: '9',
      community: { slug: 'acme' },
      meta: { thread: THREAD.CHANGELOG },
    } as TArticle

    queryClient.setQueryData(articleKeys.statsBatch('home', THREAD.POST, ['42', '7']), [
      stats(3),
      stats(7, { innerId: '7' }),
    ])
    queryClient.setQueryData(articleKeys.statsBatch('acme', THREAD.CHANGELOG, ['9']), [
      stats(9, { community: 'acme', innerId: '9', thread: THREAD.CHANGELOG }),
    ])
    queryClient.setQueryData(articleKeys.stats('home', THREAD.POST, '42'), stats(4))

    const { result } = renderHook(() => useArticleStates([third, article, second]), {
      wrapper: wrapperFor(queryClient),
    })

    expect(result.current.map(({ article: item }) => item.innerId)).toEqual(['9', '42', '7'])
    expect(result.current.map(({ stats: item }) => item?.views)).toEqual([9, 4, 7])
  })
})
