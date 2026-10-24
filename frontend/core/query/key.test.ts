import { ARTICLE_CAT, ARTICLE_ORDER } from '~/const/gtd'
import { THREAD } from '~/const/thread'

import {
  articleQueryKeys,
  commentKeys,
  isCanonicalDefaultArticleFilter,
  normalizeArticleFilter,
  viewerQueryKeys,
} from './key'

describe('query keys', () => {
  it('normalizes omitted, empty and default post filters to one canonical key', () => {
    const minimal = articleQueryKeys.pagiPosts({ community: 'home' })
    const explicit = articleQueryKeys.pagiPosts({
      community: 'home',
      page: 1,
      size: 20,
      communityTag: '',
      cat: null,
      status: undefined,
      order: '',
    })

    expect(minimal).toEqual(explicit)
    expect(normalizeArticleFilter({ community: 'home', page: 0, size: 0 })).toMatchObject({
      page: 1,
      size: 20,
    })
  })

  it('keeps meaningful filters distinct with a fixed object shape', () => {
    const filtered = articleQueryKeys.pagiPosts({
      community: 'home',
      cat: ARTICLE_CAT.BUG,
      order: ARTICLE_ORDER.UPVOTES,
    })

    expect(filtered).not.toEqual(articleQueryKeys.pagiPosts({ community: 'home' }))
    expect(filtered[4]).toEqual({
      community: 'home',
      communityTag: null,
      communityTags: [],
      cat: ARTICLE_CAT.BUG,
      status: null,
      order: ARTICLE_ORDER.UPVOTES,
      when: null,
      sort: null,
    })
    expect(filtered[3]).toMatchObject({ api: 'offset' })
    expect(filtered[5]).toMatchObject({ page: 1, size: 20 })
  })

  it('normalizes multi-tag filters independently of caller order', () => {
    const first = articleQueryKeys.pagiPosts({ community: 'home', communityTags: ['react', 'ts'] })
    const second = articleQueryKeys.pagiPosts({
      community: 'home',
      communityTags: ['ts', 'react', 'ts'],
    })

    expect(first).toEqual(second)
  })

  it('keeps page identity separate while excluding transport paging from the domain filter', () => {
    const first = articleQueryKeys.pagiPosts({ community: 'home', page: 1, size: 20 })
    const second = articleQueryKeys.pagiPosts({ community: 'home', page: 2, size: 20 })

    expect(first).not.toEqual(second)
    expect(first[4]).toEqual({
      community: 'home',
      communityTag: null,
      communityTags: [],
      cat: null,
      status: null,
      order: null,
      when: null,
      sort: null,
    })
    expect(first[5]).toEqual({ page: 1, size: 20 })
    expect(second[5]).toEqual({ page: 2, size: 20 })
  })

  it('keeps cursor continuation out of the root cache identity', () => {
    const first = articleQueryKeys.pagiChangelogs(
      { community: 'home' },
      {
        api: 'cursor',
        mode: 'infinite_scroll',
        schemaVersion: 1,
        revision: 3,
        defaultSize: 20,
        maxSize: 100,
      },
      { api: 'cursor', first: 20 },
    )
    const next = articleQueryKeys.pagiChangelogs(
      { community: 'home' },
      {
        api: 'cursor',
        mode: 'infinite_scroll',
        schemaVersion: 1,
        revision: 3,
        defaultSize: 20,
        maxSize: 100,
      },
      { api: 'cursor', first: 20, after: 'opaque' },
    )

    expect(first).toEqual(next)
  })

  it('only admits the canonical changelog filter to community-scoped SSR prefetch', () => {
    expect(isCanonicalDefaultArticleFilter({ community: 'home' })).toBe(true)
    expect(isCanonicalDefaultArticleFilter({ community: 'home', page: 2 })).toBe(false)
    expect(isCanonicalDefaultArticleFilter({ community: 'home', communityTag: 'release' })).toBe(
      false,
    )
    expect(isCanonicalDefaultArticleFilter({ community: 'home', communityTags: ['release'] })).toBe(
      false,
    )
    expect(isCanonicalDefaultArticleFilter({ community: 'home', when: 'THIS_WEEK' })).toBe(false)
  })

  it('scopes detail, comments and viewer state without secrets', () => {
    expect(articleQueryKeys.detail('home', THREAD.POST, 42)).toEqual([
      'article',
      'detail',
      'home',
      THREAD.POST,
      '42',
    ])
    expect(commentKeys.list('home', THREAD.POST, 42)).toEqual([
      'comment',
      'list',
      'home',
      THREAD.POST,
      '42',
      { mode: 'REPLIES', page: 1 },
    ])
    expect(viewerQueryKeys.articleStates('viewer-1', ['post:2', 'post:1'])).toEqual([
      'viewer',
      'viewer-1',
      'article-state',
      ['post:1', 'post:2'],
    ])
    expect(viewerQueryKeys.myReports('account-a', 2)).not.toEqual(
      viewerQueryKeys.myReports('account-b', 2),
    )
    expect(viewerQueryKeys.contentReview('account-a', { kind: 'ARTICLE' })).not.toEqual(
      viewerQueryKeys.contentReview('account-b', { kind: 'ARTICLE' }),
    )
  })

  it('matches every comment page for one article without crossing article ids', () => {
    const target = { queryKey: commentKeys.list('home', THREAD.POST, '42', 2, 'ALL') }
    const other = { queryKey: commentKeys.list('home', THREAD.POST, '99') }

    expect(commentKeys.matchesArticle(target, 'home', THREAD.POST, '42')).toBe(true)
    expect(commentKeys.matchesArticle(other, 'home', THREAD.POST, '42')).toBe(false)
  })
})

it('isolates a shared cursor link from an infinite collection that starts at the head', () => {
  const config = {
    api: 'cursor' as const,
    mode: 'load_more' as const,
    schemaVersion: 1,
    revision: 9,
    defaultSize: 20,
    maxSize: 100,
  }
  expect(articleQueryKeys.pagiPosts({ community: 'xx', after: 'saved-a' }, config)).not.toEqual(
    articleQueryKeys.pagiPosts({ community: 'xx' }, config),
  )
  expect(articleQueryKeys.pagiPosts({ community: 'xx', after: 'saved-a' }, config)).not.toEqual(
    articleQueryKeys.pagiPosts({ community: 'xx', after: 'saved-b' }, config),
  )
  expect(isCanonicalDefaultArticleFilter({ community: 'xx', after: 'saved-a' })).toBe(false)
})
