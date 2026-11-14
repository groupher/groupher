import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import type { TComment } from '~/spec'

import { commentKeys, viewerQueryKeys } from '../key'
import useCommentEmotion from './useCommentEmotion'

const mocks = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn(), toast: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.browserGraphQLRequest }))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))
vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: () => 'Action failed. Please try again.' }),
}))
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
  default: () => ({ isLogin: true, accountScope: 'user:alice', user: { login: 'alice' } }),
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
  beforeEach(() => {
    mocks.browserGraphQLRequest.mockReset()
    mocks.toast.mockReset()
  })

  it('returns the reactive optimistic emotion projection', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const listKey = commentKeys.list('home', THREAD.POST, '42')
    const viewerKey = viewerQueryKeys.commentStates('user:alice', 'home:POST:42', ['1'])
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

    act(() => result.current.toggle('HEART'))

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

  it('shows one explicit error when the direct emotion queue fails', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const listKey = commentKeys.list('home', THREAD.POST, '42')
    const viewerKey = viewerQueryKeys.commentStates('user:alice', 'home:POST:42', ['1'])
    queryClient.setQueryData(listKey, { entries: [comment] })
    queryClient.setQueryData(viewerKey, {
      '1': { emotionFlags: { HEART: false }, viewerHasUpvoted: false },
    })
    const observer = new QueryObserver(queryClient, {
      queryKey: listKey,
      queryFn: async () => ({ entries: [comment] }),
      staleTime: Number.POSITIVE_INFINITY,
    })
    const unsubscribe = observer.subscribe(() => undefined)
    mocks.browserGraphQLRequest.mockRejectedValueOnce(new Error('request failed'))
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCommentEmotion(comment), { wrapper })

    act(() => result.current.toggle('heart'))

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1))
    expect(mocks.toast).toHaveBeenCalledWith('Action failed. Please try again.', 'error')
    expect(result.current.error).toEqual(new Error('request failed'))
    await waitFor(() => expect(result.current.emotions[0]?.count).toBe(1))
    expect(mocks.browserGraphQLRequest).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('keeps failure feedback independent for different emotions on one comment', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const listKey = commentKeys.list('home', THREAD.POST, '42')
    const viewerKey = viewerQueryKeys.commentStates('user:alice', 'home:POST:42', ['1'])
    queryClient.setQueryData(listKey, { entries: [comment] })
    queryClient.setQueryData(viewerKey, {
      '1': { emotionFlags: { HEART: false, BEER: false }, viewerHasUpvoted: false },
    })
    const rejectRequests: Array<(error: Error) => void> = []
    mocks.browserGraphQLRequest.mockImplementation(
      () => new Promise((_resolve, reject) => rejectRequests.push(reject)),
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCommentEmotion(comment), { wrapper })

    act(() => {
      result.current.toggle('heart')
      result.current.toggle('beer')
    })
    await waitFor(() => expect(rejectRequests).toHaveLength(1))
    await act(async () => rejectRequests.shift()?.(new Error('heart failed')))
    await waitFor(() => expect(rejectRequests).toHaveLength(1))
    await act(async () => rejectRequests.shift()?.(new Error('beer failed')))

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(2))
    expect(mocks.toast).toHaveBeenNthCalledWith(1, 'Action failed. Please try again.', 'error')
    expect(mocks.toast).toHaveBeenNthCalledWith(2, 'Action failed. Please try again.', 'error')
    expect(result.current.error).toEqual(new Error('beer failed'))
  })
})
