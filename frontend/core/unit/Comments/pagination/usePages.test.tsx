import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { expect, it, vi } from 'vitest'

import type { TCommentPage } from '~/query/commentPage'

import useCommentPages from './usePages'
const { batch } = vi.hoisted(() => ({ batch: vi.fn(async (_ids: string[]) => ({})) }))
vi.mock('~/query', () => ({
  Q: {
    viewer: {
      commentStates: (account: string, _article: unknown, ids: string[]) => ({
        queryKey: ['viewer', account, ids],
        queryFn: () => batch(ids),
        staleTime: Infinity,
      }),
    },
  },
}))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ accountScope: 'alice', user: null }),
}))
vi.mock('~/hooks/useViewingArticle', () => ({ default: () => ({ stats: {} }) }))
const collection = {
  article: { community: 'home', thread: 'POST' as const, innerId: '1' },
  mode: 'REPLIES' as const,
}
const page = (innerId: string) =>
  ({
    entries: [{ innerId }],
    pinnedEntries: [],
    pageInfo: {
      api: 'cursor',
      __typename: 'CursorPageInfo',
      startCursor: null,
      endCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  }) as TCommentPage
it('appending a cursor chunk fetches viewer state only for the new chunk', async () => {
  const client = new QueryClient()
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const first = page('1'),
    second = page('2')
  const { rerender } = renderHook(({ pages }) => useCommentPages(pages, collection), {
    wrapper,
    initialProps: { pages: [first] },
  })
  await waitFor(() => expect(batch).toHaveBeenCalledTimes(1))
  rerender({ pages: [first, second] })
  await waitFor(() => expect(batch).toHaveBeenCalledTimes(2))
  expect(batch.mock.calls.map(([ids]) => ids)).toEqual([['1'], ['2']])
})
