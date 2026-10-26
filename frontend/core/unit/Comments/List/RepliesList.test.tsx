import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_EFFECTIVE_PAGI_CONFIG } from '~/lib/pagination/params'
import createCommentsStore from '~/stores/comments'
import { StoreContext } from '~/stores/comments/context'

import { CommentFeedContext, type TCommentFeed } from '../pagination/context'
import RootFeed from '../pagination/RootFeed'
import RepliesList from './RepliesList'

const { request, viewing } = vi.hoisted(() => ({
  request: vi.fn(),
  viewing: {
    stats: {},
    article: null,
    articlePath: { community: 'home', thread: 'POST' as const, innerId: '1' },
  },
}))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: request }))
vi.mock('~/query', async () => ({
  Q: {
    comment: (await import('~/query/comment')).commentQueries,
    viewer: {
      commentStates: (_account: string, _path: unknown, ids: string[]) => ({
        queryKey: ['viewer', ids],
        queryFn: async () => ({}),
        enabled: false,
      }),
    },
  },
}))
vi.mock('~/stores/account/hooks', () => ({ default: () => ({ user: null, accountScope: '' }) }))
vi.mock('~/hooks/useViewingArticle', () => ({ default: () => viewing }))
vi.mock('~/hooks/useURLSearchParams', () => ({ default: () => new URLSearchParams() }))
vi.mock('~/stores/dsbConfig/hooks', () => ({
  default: () => ({ pagiMode: 'load_more', pagiRevision: 0 }),
}))
vi.mock('~/query/useCommentReceiptReconcile', () => ({ default: () => undefined }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('./salon/replies_list', () => ({ default: () => ({}) }))
vi.mock('./salon/toggler_button', () => ({ default: () => ({}) }))
vi.mock('../Comment', () => ({
  default: ({ data }: { data: { innerId: string } }) => <p>{data.innerId}</p>,
}))
vi.mock('~/ui/Pagi', () => ({
  default: ({
    onChange,
    pageInfo,
  }: {
    onChange: (page: number) => void
    pageInfo: { page: number }
  }) => (
    <button type='button' onClick={() => onChange(pageInfo.page + 1)}>
      next offset
    </button>
  ),
}))
vi.mock('~/ui/Pagi/CursorPagination', () => ({
  default: ({
    mode,
    onLoadMore,
    hasNextPage,
    error,
  }: {
    mode: string
    onLoadMore: () => void
    hasNextPage: boolean
    error?: Error
  }) =>
    hasNextPage || error ? (
      <button type='button' data-mode={mode} onClick={onLoadMore}>
        {error ? 'retry next' : 'next cursor'}
      </button>
    ) : null,
}))

const response = (ids: string[], next = false) => ({
  commentReplyPage: {
    entries: ids.map((innerId) => ({ innerId })),
    pageInfo: {
      __typename: 'CursorPageInfo',
      startCursor: 'start',
      endCursor: 'next',
      hasPreviousPage: false,
      hasNextPage: next,
    },
  },
})
const deferred = () => {
  let resolve!: (value: unknown) => void
  let reject!: (error: Error) => void
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function setup(
  api: 'cursor' | 'offset' = 'cursor',
  mode = api === 'cursor' ? 'load_more' : 'page',
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const feed = {
    collection: { article: { community: 'home', thread: 'POST', innerId: '1' }, mode: 'REPLIES' },
    config: {
      ...DEFAULT_EFFECTIVE_PAGI_CONFIG,
      api,
      mode,
    },
  } as TCommentFeed
  render(
    <QueryClientProvider client={client}>
      <CommentFeedContext.Provider value={feed}>
        <section aria-label='first'>
          <RepliesList
            parentId='10'
            apiMode='article'
            entries={[{ innerId: 'preview' }]}
            repliesCount={6}
            foldedIdSet={new Set()}
          />
        </section>
        <section aria-label='second'>
          <RepliesList
            parentId='20'
            apiMode='article'
            entries={[]}
            repliesCount={6}
            foldedIdSet={new Set()}
          />
        </section>
      </CommentFeedContext.Provider>
    </QueryClientProvider>,
  )
  return client
}

describe('independent reply paging', () => {
  it('loads two roots concurrently and replaces the preview with each formal page', async () => {
    const a = deferred(),
      b = deferred()
    request.mockImplementation((_doc, variables) =>
      variables.comment.innerId === '10' ? a.promise : b.promise,
    )
    setup()
    const first = within(screen.getByRole('region', { name: 'first' }))
    const second = within(screen.getByRole('region', { name: 'second' }))
    fireEvent.click(first.getByText('查看全部 6 条回复'))
    fireEvent.click(second.getByText('查看全部 6 条回复'))
    expect(first.queryByText('preview')).not.toBeInTheDocument()
    await act(async () => b.resolve(response(['b'])))
    expect(await second.findByText('b')).toBeInTheDocument()
    await act(async () => a.resolve(response(['a'])))
    expect(await first.findByText('a')).toBeInTheDocument()
  })
  it('keeps loaded cursor entries on next-page error and retries without duplicates', async () => {
    request
      .mockResolvedValueOnce(response(['a'], true))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(response(['a', 'b']))
    setup()
    const first = within(screen.getByRole('region', { name: 'first' }))
    fireEvent.click(first.getByText('查看全部 6 条回复'))
    await first.findByText('a')
    fireEvent.click(first.getByText('next cursor'))
    await first.findByText('retry next')
    expect(first.getByText('a')).toBeInTheDocument()
    fireEvent.click(first.getByText('retry next'))
    await first.findByText('b')
    expect(first.getAllByText('a')).toHaveLength(1)
    expect(first.queryByText('next cursor')).not.toBeInTheDocument()
  })
  it.each(['offset', 'cursor'] as const)(
    'always appends cursor reply pages under a %s root feed',
    async (api) => {
      request.mockImplementation((_doc, variables) =>
        Promise.resolve(
          response(
            [variables.pagi.cursor.after ? 'second-page' : 'first-page'],
            !variables.pagi.cursor.after,
          ),
        ),
      )
      setup(api)
      const first = within(screen.getByRole('region', { name: 'first' }))
      fireEvent.click(first.getByText('查看全部 6 条回复'))
      await first.findByText('first-page')
      expect(first.queryByText('next offset')).not.toBeInTheDocument()
      fireEvent.click(first.getByText('next cursor'))
      await first.findByText('second-page')
      expect(first.getByText('first-page')).toBeInTheDocument()
      expect(request.mock.calls.at(-1)?.[1].pagi).toHaveProperty('cursor.after', 'next')
    },
  )
  it('switching articles resets expanded replies and ignores the previous article response', async () => {
    const old = deferred()
    viewing.articlePath.innerId = '1'
    request.mockImplementation((_doc, variables) => {
      if (!variables.comment)
        return Promise.resolve({
          commentPage: { ...response([]).commentReplyPage, pinnedEntries: [] },
        })
      return variables.comment.article.innerId === '1'
        ? old.promise
        : Promise.resolve(response(['new-reply']))
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const store = createCommentsStore()
    const tree = () => (
      <QueryClientProvider client={client}>
        <StoreContext.Provider value={store}>
          <RootFeed>
            <RepliesList
              parentId='10'
              apiMode='article'
              entries={[{ innerId: `preview-${viewing.articlePath.innerId}` }]}
              repliesCount={6}
              foldedIdSet={new Set()}
            />
          </RootFeed>
        </StoreContext.Provider>
      </QueryClientProvider>
    )
    const { rerender } = render(tree())
    fireEvent.click(screen.getByText('查看全部 6 条回复'))
    viewing.articlePath.innerId = '2'
    rerender(tree())
    expect(await screen.findByText('preview-2')).toBeInTheDocument()
    await act(async () => old.resolve(response(['old-reply'])))
    expect(screen.queryByText('old-reply')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('查看全部 6 条回复'))
    expect(await screen.findByText('new-reply')).toBeInTheDocument()
    expect(screen.queryByText('old-reply')).not.toBeInTheDocument()
  })
})

it.each(['page', 'load_more', 'infinite_scroll'])(
  'replies stay manual when the root mode is %s',
  async (mode) => {
    request.mockResolvedValue(response(['reply'], true))
    setup(mode === 'page' ? 'offset' : 'cursor', mode)
    fireEvent.click(
      within(screen.getByRole('region', { name: 'first' })).getByText('查看全部 6 条回复'),
    )
    expect(await screen.findByText('next cursor')).toHaveAttribute('data-mode', 'load_more')
    expect(request.mock.calls[0][1].pagi).toHaveProperty('cursor')
    expect(request.mock.calls[0][1].pagi).not.toHaveProperty('offset')
  },
)
