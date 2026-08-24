import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import type { TComment } from '~/spec'

import { commentKeys } from '../key'
import useCommentModeration from './useCommentModeration'

const mocks = vi.hoisted(() => ({ browserQuery: vi.fn() }))

vi.mock('~/graphql/client', () => ({ browserQuery: mocks.browserQuery }))
vi.mock('~/hooks/useViewingArticle', () => ({
  default: () => ({
    article: {
      community: { slug: 'home' },
      innerId: '42',
      meta: { thread: THREAD.POST },
    },
  }),
}))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ user: { login: 'alice' } }),
}))

const comment = { innerId: '1', replies: [] } as TComment

describe('useCommentModeration', () => {
  beforeEach(() => {
    mocks.browserQuery.mockReset()
    mocks.browserQuery.mockResolvedValue({ deleteComment: { ok: true } })
  })

  it('deletes only the comment in the current article cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    })
    const currentArticleKey = commentKeys.list('home', THREAD.POST, '42')
    const otherArticleKey = commentKeys.list('home', THREAD.POST, '99')
    queryClient.setQueryData(currentArticleKey, { entries: [comment] })
    queryClient.setQueryData(otherArticleKey, { entries: [{ ...comment }] })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCommentModeration(comment), { wrapper })

    act(() => result.current.deleteComment())
    await waitFor(() => expect(mocks.browserQuery).toHaveBeenCalledOnce())

    expect(queryClient.getQueryData<{ entries: TComment[] }>(currentArticleKey)?.entries).toEqual(
      [],
    )
    expect(
      queryClient.getQueryData<{ entries: TComment[] }>(otherArticleKey)?.entries,
    ).toHaveLength(1)
  })
})
