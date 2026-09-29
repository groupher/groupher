import { describe, expect, it } from 'vitest'

import vectors from '../fixtures/public-cache-tags-v1.json'
import { isPublicCacheTag, publicCacheTags } from './public-cache'

describe('public cache tag contract', () => {
  it.each(vectors.vectors)('matches the golden vector for $kind', (vector) => {
    const input = vector.input as {
      community: string
      thread?: string
      innerId?: string
    }
    const tag =
      vector.kind === 'community'
        ? publicCacheTags.community(input.community)
        : vector.kind === 'docTree'
          ? publicCacheTags.docTree(input.community)
          : vector.kind === 'articleList'
            ? publicCacheTags.articleList(input.community, input.thread!)
            : vector.kind === 'tags'
              ? publicCacheTags.tags(input.community, input.thread!)
              : vector.kind === 'comments'
                ? publicCacheTags.comments(input.community, input.thread!, input.innerId!)
                : publicCacheTags.articleDetail(input.community, input.thread!, input.innerId!)

    expect(tag).toBe(vector.expected)
    expect(isPublicCacheTag(tag)).toBe(true)
  })

  it('rejects malformed tags before they reach a purge adapter', () => {
    expect(isPublicCacheTag('community[home]-thread[POST]-article[42]')).toBe(true)
    expect(isPublicCacheTag('community[]')).toBe(false)
    expect(isPublicCacheTag('https://example.com')).toBe(false)
  })
})
