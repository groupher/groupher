import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import type { TComment } from '~/spec'

import { commentKeys, viewerQueryKeys } from '../key'
import useCommentUpvote from './useCommentUpvote'

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
  emotions: [],
  meta: {},
  replies: [],
  upvotesCount: 3,
  viewerHasUpvoted: false,
} as unknown as TComment

describe('useCommentUpvote', () => {
  it('coalesces rapid toggles into one serial lane and reaches the final intent', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    })
    const listKey = commentKeys.list('home', THREAD.POST, '42')
    const viewerKey = viewerQueryKeys.commentStates('alice', 'home:POST:42', ['1'])
    queryClient.setQueryData(listKey, { entries: [comment] })
    queryClient.setQueryData(viewerKey, {
      '1': { emotionFlags: {}, viewerHasUpvoted: false },
    })
    const responses: Array<(value: unknown) => void> = []
    mocks.browserGraphQLRequest.mockImplementation(
      () => new Promise((resolve) => responses.push(resolve)),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCommentUpvote(comment), { wrapper })

    act(() => {
      result.current.toggle()
      result.current.toggle()
    })

    await waitFor(() => expect(mocks.browserGraphQLRequest).toHaveBeenCalledTimes(1))
    await act(async () => {
      responses.shift()?.({
        upvoteComment: { ...comment, upvotesCount: 4, viewerHasUpvoted: true },
      })
    })
    await waitFor(() => expect(mocks.browserGraphQLRequest).toHaveBeenCalledTimes(2))
    await act(async () => {
      responses.shift()?.({
        undoUpvoteComment: { ...comment, upvotesCount: 3, viewerHasUpvoted: false },
      })
    })

    await waitFor(() => {
      const list = queryClient.getQueryData<{ entries: TComment[] }>(listKey)
      const viewer =
        queryClient.getQueryData<Record<string, { viewerHasUpvoted: boolean }>>(viewerKey)
      expect(list?.entries[0].upvotesCount).toBe(3)
      expect(viewer?.['1'].viewerHasUpvoted).toBe(false)
      expect(result.current).toMatchObject({ count: 3, isUpvoted: false })
    })
  })
})
