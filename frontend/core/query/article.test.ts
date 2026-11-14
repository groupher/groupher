import { THREAD } from '~/const/thread'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { articlePageEntries } from '~/lib/pagination/merge'

import { articlePagiRequest, articleQueries } from './article'
import { articlePathOf } from './articlePath'

const { browserGraphQLRequest } = vi.hoisted(() => ({ browserGraphQLRequest: vi.fn() }))
vi.mock('~/graphql/client', () => ({ browserGraphQLRequest }))

describe('article detail content query', () => {
  beforeEach(() => {
    browserGraphQLRequest.mockReset()
  })

  it('does not couple content loading to view tracking', async () => {
    browserGraphQLRequest.mockResolvedValue({ post: { innerId: '42' } })

    const options = articleQueries.detail('home', THREAD.POST, '42')
    await options.queryFn?.({} as never)
    await options.queryFn?.({} as never)

    expect(browserGraphQLRequest).toHaveBeenCalledTimes(2)
    expect(browserGraphQLRequest.mock.calls[0][1]).toEqual({
      article: { community: 'home', innerId: '42', thread: THREAD.POST },
    })
  })

  it('does not record acceptance when the detail read fails', async () => {
    const requestError = new Error('network')
    browserGraphQLRequest.mockRejectedValue(requestError)

    const options = articleQueries.detail('home', THREAD.POST, '42')
    const caught = await options.queryFn?.({} as never).catch((error) => error)

    expect(caught).toBe(requestError)
    expect(caught.message).toBe('network')
    expect(browserGraphQLRequest).toHaveBeenCalledTimes(1)
  })

  it('caches the canonical page unchanged', async () => {
    browserGraphQLRequest.mockResolvedValue({
      postPage: {
        pinnedEntries: [{ innerId: '1', title: 'Pinned' }],
        entries: [{ innerId: '2', title: 'Regular' }],
        pageInfo: {
          __typename: 'OffsetPageInfo',
          page: 2,
          size: 20,
          totalCount: 41,
          totalPages: 3,
          hasPreviousPage: true,
          hasNextPage: true,
        },
      },
    })

    const options = articleQueries.posts({ community: 'home', page: 2, size: 20 })
    const result = await options.queryFn?.({} as never)

    expect(browserGraphQLRequest.mock.calls[0][1]).toEqual({
      pagi: { offset: { page: 2, size: 20, configRevision: 0 } },
      filter: { community: 'home' },
      thread: 'POST',
    })
    expect(result).toMatchObject({
      pinnedEntries: [{ innerId: '1' }],
      entries: [{ innerId: '2' }],
      pageInfo: { __typename: 'OffsetPageInfo', page: 2, size: 20, totalCount: 41, totalPages: 3 },
    })
  })

  it('builds offset and cursor requests from the route filter', () => {
    expect(
      articlePagiRequest(
        { community: 'home', page: 2, size: 40 },
        {
          api: 'offset',
          mode: 'PAGE',
          schemaVersion: 1,
          revision: 7,
          defaultSize: 20,
          maxSize: 100,
        },
      ),
    ).toEqual({ api: 'offset', page: 2, size: 40, configRevision: 7 })

    expect(
      articlePagiRequest(
        { community: 'home', size: 10 },
        {
          api: 'cursor',
          mode: 'LOAD_MORE',
          schemaVersion: 1,
          revision: 8,
          defaultSize: 20,
          maxSize: 100,
        },
        'next-cursor',
      ),
    ).toEqual({ api: 'cursor', first: 10, after: 'next-cursor', configRevision: 8 })
  })

  it('does not silently replace invalid zero pagination values with defaults', () => {
    expect(
      articlePagiRequest(
        { community: 'home', page: 0, size: 0 },
        {
          api: 'offset',
          mode: 'PAGE',
          schemaVersion: 1,
          revision: 7,
          defaultSize: 20,
          maxSize: 100,
        },
      ),
    ).toEqual({ api: 'offset', page: 0, size: 0, configRevision: 7 })
  })
})

describe('configured route pagination size', () => {
  it.each(['offset', 'cursor'] as const)(
    'uses the configured default and matching key for %s',
    (api) => {
      const config = {
        api,
        mode: api === 'offset' ? ('PAGE' as const) : ('LOAD_MORE' as const),
        schemaVersion: 1,
        revision: 7,
        defaultSize: 10,
        maxSize: 10,
      }
      const filter = getPagedArticlesParams(
        'home',
        new URLSearchParams('page=2&order=publish'),
        config.defaultSize,
      )
      const request = articlePagiRequest(filter, config)
      expect(request).toMatchObject(api === 'offset' ? { page: 2, size: 10 } : { first: 10 })
      expect(request.configRevision).toBe(7)
      const explicit = articlePagiRequest({ ...filter, size: 5 }, config)
      expect(explicit).toMatchObject(api === 'offset' ? { size: 5 } : { first: 5 })
    },
  )
})

it('normalizes generated Lite thread fields into the canonical path used by stats, viewer batches and dedupe', () => {
  for (const thread of ['POST', 'CHANGELOG'] as const) {
    const page = {
      pinnedEntries: [{ innerId: '1', isPinned: true, thread, community: { slug: 'home' } }],
      entries: [{ innerId: '2', thread, community: { slug: 'home' } }],
      pageInfo: { __typename: 'CursorPageInfo' },
    }
    const result = { entries: articlePageEntries(page) }
    expect(result.entries.map(articlePathOf)).toEqual([
      { community: 'home', thread, innerId: '1' },
      { community: 'home', thread, innerId: '2' },
    ])
    expect(result.entries[0].isPinned).toBe(true)
  }
})
