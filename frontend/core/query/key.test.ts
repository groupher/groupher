import { ARTICLE_CAT, ARTICLE_ORDER } from '~/const/gtd'
import { THREAD } from '~/const/thread'

import {
  articleKeys,
  commentKeys,
  isCanonicalDefaultArticleFilter,
  normalizeArticleFilter,
  viewerKeys,
} from './key'

describe('query keys', () => {
  it('normalizes omitted, empty and default post filters to one canonical key', () => {
    const minimal = articleKeys.posts({ community: 'home' })
    const explicit = articleKeys.posts({
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
    const filtered = articleKeys.posts({
      community: 'home',
      cat: ARTICLE_CAT.BUG,
      order: ARTICLE_ORDER.UPVOTES,
    })

    expect(filtered).not.toEqual(articleKeys.posts({ community: 'home' }))
    expect(filtered[2]).toEqual({
      community: 'home',
      page: 1,
      size: 20,
      communityTag: null,
      communityTags: [],
      cat: ARTICLE_CAT.BUG,
      status: null,
      order: ARTICLE_ORDER.UPVOTES,
      when: null,
      sort: null,
    })
  })

  it('normalizes multi-tag filters independently of caller order', () => {
    const first = articleKeys.posts({ community: 'home', communityTags: ['react', 'ts'] })
    const second = articleKeys.posts({ community: 'home', communityTags: ['ts', 'react', 'ts'] })

    expect(first).toEqual(second)
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
    expect(articleKeys.detail('home', THREAD.POST, 42)).toEqual([
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
    expect(viewerKeys.articleStates('viewer-1', ['post:2', 'post:1'])).toEqual([
      'viewer',
      'viewer-1',
      'article-state',
      ['post:1', 'post:2'],
    ])
  })
})
