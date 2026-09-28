import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import type { TComment } from '~/spec'

import { commentKeys, viewerQueryKeys } from '../key'
import useCommentEmotion from './useCommentEmotion'

const mocks = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.browserGraphQLRequest }))
vi.mock('~/hooks/useViewingArticle', () => ({
  default: () => ({
    article: {
      community: { slug: 'home' },
      innerId: '42',
      meta: { thread: 'POST' },
    },
  }),
}))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ isLogin: true, user: { login: 'alice' } }),
}))

const comment = {
  innerId: '1',
  emotions: [{ type: 'HEART', count: 1, latestUsers: [] }],
  meta: {},
  replies: [],
  upvotesCount: 3,
  viewerHasUpvoted: false,
} as unknown as TComment

describe('useCommentEmotion', () => {
  it('returns the reactive optimistic emotion projection', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const listKey = commentKeys.list('home', THREAD.POST, '42')
    const viewerKey = viewerQueryKeys.commentStates('alice', 'home:POST:42', ['1'])
    queryClient.setQueryData(listKey, { entries: [comment] })
    queryClient.setQueryData(viewerKey, {
      '1': { emotionFlags: { HEART: false }, viewerHasUpvoted: false },
    })
    let confirm: ((value: unknown) => void) | undefined
    mocks.browserGraphQLRequest.mockImplementation(
      () => new Promise((resolve) => (confirm = resolve)),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCommentEmotion(comment), { wrapper })

    act(() => result.current.toggle('heart'))

    await waitFor(() => expect(result.current.emotions[0]?.count).toBe(2))
    await act(async () => {
      confirm?.({
        emotionToComment: {
          ...comment,
          emotions: [{ type: 'HEART', count: 2, latestUsers: [], viewerHasReacted: true }],
        },
      })
    })
  })
})
