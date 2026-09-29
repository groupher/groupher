import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import { articleQueryKeys, viewerQueryKeys } from '~/query'
import {
  readArticleUpvoteReceipt,
  writeArticleUpvoteReceipt,
} from '~/query/mutation/articleReceipt'
import { readArticleViewAck, writeArticleViewAck } from '~/query/viewAck'
import type { TArticle, TArticleStats, TUser } from '~/spec'
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

const wrapperFor = (queryClient: QueryClient, user: TUser | null = null) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AccountStoreProvider initData={{ loading: false, user }}>{children}</AccountStoreProvider>
    </QueryClientProvider>
  )
}

describe('useArticleStates', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('uses the batch stats owner and applies one shared view acknowledgement overlay', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    const key = 'home:POST:42'
    queryClient.setQueryData(articleQueryKeys.statsBatch('home', THREAD.POST, ['42']), [stats(3)])
    queryClient.setQueryData(viewerQueryKeys.articleStates('', [key]), {
      [key]: { articleKey: key, viewerHasViewed: false },
    })
    writeArticleViewAck(key)

    const { result } = renderHook(() => useArticleStates([article]), {
      wrapper: wrapperFor(queryClient),
    })

    expect(result.current[0]?.stats?.views).toBe(3)
    expect(result.current[0]?.viewerState.viewerHasViewed).toBe(true)
    expect(
      queryClient.getQueryState(articleQueryKeys.stats('home', THREAD.POST, '42')),
    ).toBeUndefined()

    act(() => {
      queryClient.setQueryData(viewerQueryKeys.articleStates('', [key]), {
        [key]: { articleKey: key, viewerHasViewed: true },
      })
    })

    await waitFor(() => expect(readArticleViewAck(key)).toBeNull())
  })

  it('groups multiple real batches while preserving input order', () => {
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

    queryClient.setQueryData(articleQueryKeys.statsBatch('home', THREAD.POST, ['42', '7']), [
      stats(3),
      stats(7, { innerId: '7' }),
    ])
    queryClient.setQueryData(articleQueryKeys.statsBatch('acme', THREAD.CHANGELOG, ['9']), [
      stats(9, { community: 'acme', innerId: '9', thread: THREAD.CHANGELOG }),
    ])
    const { result } = renderHook(() => useArticleStates([third, article, second]), {
      wrapper: wrapperFor(queryClient),
    })

    expect(result.current.map(({ content }) => content.innerId)).toEqual(['9', '42', '7'])
    expect(result.current.map(({ stats: item }) => item?.views)).toEqual([9, 3, 7])
    expect(
      queryClient.getQueryState(articleQueryKeys.stats('home', THREAD.POST, '42')),
    ).toBeUndefined()
  })

  it('re-reads acknowledgements and receipts written after mount', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    const accountRef = 'alice'
    const key = 'home:POST:42'
    const statsKey = articleQueryKeys.statsBatch('home', THREAD.POST, ['42'])
    const viewerKey = viewerQueryKeys.articleStates(accountRef, [key])
    const interactionKey = viewerQueryKeys.articleInteractionStates(accountRef, [key])
    const interactionState = {
      articleKey: key,
      community: 'home',
      thread: THREAD.POST,
      innerId: '42',
      interactionRevision: 0,
      viewerHasUpvoted: false,
      viewerHasCollected: false,
      viewerEmotion: null,
    }

    queryClient.setQueryData(statsKey, [stats(3)])
    queryClient.setQueryData(viewerKey, {
      [key]: { articleKey: key, viewerHasViewed: false },
    })
    queryClient.setQueryData(interactionKey, { [key]: interactionState })

    const { result } = renderHook(() => useArticleStates([article]), {
      wrapper: wrapperFor(queryClient, { accountRef, login: accountRef } as TUser),
    })

    expect(result.current[0]?.viewerState.viewerHasViewed).toBe(false)
    expect(result.current[0]?.viewerState.viewerHasUpvoted).toBe(false)

    act(() => {
      writeArticleViewAck(key)
      writeArticleUpvoteReceipt({
        accountRef,
        entityKey: key,
        commandId: 'confirmed-after-mount',
        interactionRevision: 2,
        viewerHasUpvoted: true,
      })
      queryClient.setQueryData(statsKey, [stats(4, { interactionRevision: 1 })])
      queryClient.setQueryData(interactionKey, {
        [key]: { ...interactionState, interactionRevision: 1 },
      })
    })

    await waitFor(() => {
      expect(result.current[0]?.viewerState.viewerHasViewed).toBe(true)
      expect(result.current[0]?.viewerState.viewerHasUpvoted).toBe(true)
    })

    act(() => {
      queryClient.setQueryData(statsKey, [stats(5, { interactionRevision: 2 })])
      queryClient.setQueryData(viewerKey, {
        [key]: { articleKey: key, viewerHasViewed: true },
      })
      queryClient.setQueryData(interactionKey, {
        [key]: { ...interactionState, interactionRevision: 2, viewerHasUpvoted: true },
      })
    })

    await waitFor(() => {
      expect(readArticleViewAck(key)).toBeNull()
      expect(readArticleUpvoteReceipt(accountRef, key)).toBeNull()
    })
  })
})
