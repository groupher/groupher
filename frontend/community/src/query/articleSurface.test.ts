import { QueryClient } from '@tanstack/react-query'
import { afterEach } from 'vitest'
import { beforeEach, expect, it, vi } from 'vitest'

import { articleQueryKeys, dsbKeys } from '~/query'
import { articleQueries } from '~/query/article'
import type { TEffectivePagiConfig } from '~/spec'

const transport = vi.hoisted(() => ({
  loadPosts: vi.fn(),
  loadChangelogs: vi.fn(),
  loadArticleStats: vi.fn(),
  refreshCommunity: vi.fn(),
}))
vi.mock('../server/community', () => transport)

import { isPaginationRevisionMismatch, loadArticleSurface } from './articleSurface'

const config: TEffectivePagiConfig = {
  api: 'offset',
  mode: 'page',
  schemaVersion: 1,
  revision: 1,
  defaultSize: 20,
  maxSize: 10,
}
const mismatch = (subtype: string, code = 4211) =>
  Object.assign(new Error('pagi failure'), {
    errors: [{ extensions: { code, mismatch: subtype } }],
  })
const page = (api: 'offset' | 'cursor' = 'offset') => ({
  entries: [],
  pinnedEntries: [],
  pageInfo:
    api === 'offset'
      ? {
          __typename: 'OffsetPageInfo',
          page: 1,
          size: 20,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      : {
          __typename: 'CursorPageInfo',
          endCursor: null,
          startCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
        },
})
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(dsbKeys.config('home'), {
    pagiMode: config.mode,
    pagiRevision: config.revision,
  })
  transport.loadArticleStats.mockResolvedValue([])
  return client
}

beforeEach(() => vi.resetAllMocks())

it.each(['posts', 'changelogs'] as const)(
  'restarts %s once with fresh bootstrap, matching browser keys and sizes',
  async (surface) => {
    const client = setup()
    const load = surface === 'posts' ? transport.loadPosts : transport.loadChangelogs
    const fresh = {
      ...config,
      api: 'cursor' as const,
      mode: 'infinite_scroll' as const,
      revision: 2,
    }
    transport.refreshCommunity.mockResolvedValue({
      community: { slug: 'home' },
      dashboard: { pagiMode: fresh.mode, pagiRevision: fresh.revision },
    })
    load.mockRejectedValueOnce(mismatch('revision')).mockResolvedValueOnce(page('cursor'))
    const result = await loadArticleSurface(client, 'home', surface, '?page=2&order=publish')
    expect(result).toEqual({ recovery: null, resetPage: true })
    expect(transport.refreshCommunity).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(2)
    expect(load.mock.calls[0][0].data.pagi).toEqual({
      offset: { page: 2, size: 20, configRevision: 1 },
    })
    expect(load.mock.calls[1][0].data.pagi).toEqual({ cursor: { first: 20, configRevision: 2 } })
    const browser =
      surface === 'posts' ? articleQueries.postsInfinite : articleQueries.changelogsInfinite
    expect(
      client.getQueryData(
        browser({ community: 'home', page: 1, size: 20, order: 'PUBLISH' }, fresh).queryKey,
      ),
    ).toMatchObject({ pages: [page('cursor')], pageParams: [null] })
    expect(
      client.getQueryCache().findAll({ queryKey: [...articleQueryKeys.all, surface, 'pagi'] }),
    ).toHaveLength(1)
  },
)

it.each(['api', 'missing'] as const)('does not refresh or retry %s mismatch', async (subtype) => {
  const client = setup()
  transport.loadPosts.mockRejectedValue(mismatch(subtype))
  expect(await loadArticleSurface(client, 'home', 'posts', '')).toEqual({
    recovery: 'list',
    resetPage: false,
  })
  expect(transport.loadPosts).toHaveBeenCalledTimes(1)
  expect(transport.refreshCommunity).not.toHaveBeenCalled()
  expect(
    client.getQueryCache().findAll({ queryKey: [...articleQueryKeys.all, 'posts', 'pagi'] }),
  ).toHaveLength(0)
})

it.each([4209, 4210, 4212])('does not refresh or retry config error %s', async (code) => {
  const client = setup()
  transport.loadPosts.mockRejectedValue(mismatch('revision', code))
  expect((await loadArticleSurface(client, 'home', 'posts', '')).recovery).toBe('list')
  expect(transport.loadPosts).toHaveBeenCalledTimes(1)
  expect(transport.refreshCommunity).not.toHaveBeenCalled()
})

it('returns a recoverable shell on repeated revision mismatch, records it, and preserves other list families', async () => {
  const client = setup()
  const other = articleQueries.changelogs({ community: 'home' }).queryKey
  client.setQueryData(other, {
    entries: [],
    pinnedEntries: [],
    pageInfo: {
      __typename: 'OffsetPageInfo',
      page: 1,
      size: 20,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })
  transport.refreshCommunity.mockResolvedValue({
    community: { slug: 'home' },
    dashboard: { pagiMode: config.mode, pagiRevision: 2 },
  })
  transport.loadPosts.mockRejectedValue(mismatch('revision'))
  const event = vi.fn()
  window.addEventListener('groupher:pagi', event)
  try {
    expect(await loadArticleSurface(client, 'home', 'posts', '')).toEqual({
      recovery: 'bootstrap',
      resetPage: false,
    })
    expect(transport.loadPosts).toHaveBeenCalledTimes(2)
    expect(
      client.getQueryCache().findAll({ queryKey: [...articleQueryKeys.all, 'posts', 'pagi'] }),
    ).toHaveLength(0)
    expect(client.getQueryData(other)).toMatchObject({
      entries: [],
      pinnedEntries: [],
      pageInfo: { __typename: 'OffsetPageInfo' },
    })
    expect(event.mock.calls[0][0].detail).toEqual({
      surface: 'posts',
      event: 'ssr_failure',
      attempt: 2,
    })
  } finally {
    window.removeEventListener('groupher:pagi', event)
  }
})

it('rejects ambiguous or mixed error sets as revision-only recovery candidates', () => {
  expect(isPaginationRevisionMismatch(null)).toBe(false)
  expect(isPaginationRevisionMismatch({ errors: 'invalid' })).toBe(false)
  expect(isPaginationRevisionMismatch({ errors: [null] })).toBe(false)
  expect(isPaginationRevisionMismatch({ errors: [] })).toBe(false)
  expect(isPaginationRevisionMismatch({ errors: [{ extensions: { code: 4211 } }] })).toBe(false)
  expect(
    isPaginationRevisionMismatch({
      errors: [...mismatch('revision').errors, { extensions: { code: 4210 } }],
    }),
  ).toBe(false)
})

const testViewportWidth = window.innerWidth
beforeEach(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 }))
afterEach(() =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: testViewportWidth }),
)
