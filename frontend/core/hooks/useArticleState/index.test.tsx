import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import { articleQueryKeys, viewerQueryKeys } from '~/query'
import type { TArticle, TArticleStats } from '~/spec'
import AccountStoreProvider from '~/stores/account/provider'

import useArticleState from '.'

const article = {
  innerId: '42',
  community: { slug: 'home' },
  meta: { thread: THREAD.POST },
} as TArticle

const stats: TArticleStats = {
  community: 'home',
  thread: THREAD.POST,
  innerId: '42',
  views: 3,
  viewsRevision: 1,
  upvotesCount: 2,
  commentsCount: 1,
  collectsCount: 0,
  commentsParticipantsCount: 1,
  interactionRevision: 2,
  commentsRevision: 1,
  emotionCounts: [],
  snapshotAt: new Date().toISOString(),
}

const wrapperFor = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AccountStoreProvider initData={{ loading: false, user: null }}>
          {children}
        </AccountStoreProvider>
      </QueryClientProvider>
    )
  }

describe('useArticleState', () => {
  it('composes detail stats and private owners into the shared content shape', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    const articleKey = 'home:POST:42'
    queryClient.setQueryData(articleQueryKeys.stats('home', THREAD.POST, '42'), stats)
    queryClient.setQueryData(viewerQueryKeys.articleStates('', [articleKey]), {
      [articleKey]: { articleKey, viewerHasViewed: true },
    })
    queryClient.setQueryData(viewerQueryKeys.articleInteractionStates('', [articleKey]), {
      [articleKey]: {
        articleKey,
        interactionRevision: 2,
        viewerHasUpvoted: true,
        viewerHasCollected: false,
        viewerEmotion: null,
      },
    })

    const { result } = renderHook(() => useArticleState(article), {
      wrapper: wrapperFor(queryClient),
    })

    expect(result.current).toMatchObject({
      content: article,
      stats: { views: 3, upvotesCount: 2 },
      viewerState: { viewerHasViewed: true, viewerHasUpvoted: true },
    })
    expect(
      queryClient.getQueryState(articleQueryKeys.statsBatch('home', THREAD.POST, ['42'])),
    ).toBeUndefined()
  })
})
