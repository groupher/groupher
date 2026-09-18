import { beforeEach, describe, expect, it, vi } from 'vitest'

const responseHeaders = vi.hoisted(() => new Map<string, string | string[]>())

vi.mock('@tanstack/react-start/server', () => ({
  getResponseHeader: (name: string) => responseHeaders.get(name),
  setResponseHeader: (name: string, value: string) => responseHeaders.set(name, value),
}))

import { mergeCacheTags, setPublicCacheHeaders } from './cache-headers'

beforeEach(() => responseHeaders.clear())

describe('Community response cache tags', () => {
  it('accumulates parent and child loader tags without duplicates', () => {
    expect(
      mergeCacheTags('community[home], community[home]-thread[POST]-articles', [
        'community[home]-thread[POST]-article[42]',
        'community[home]-thread[POST]-articles',
      ]),
    ).toEqual([
      'community[home]',
      'community[home]-thread[POST]-articles',
      'community[home]-thread[POST]-article[42]',
    ])
  })

  it('accepts repeated header values from the response context', () => {
    expect(mergeCacheTags(['community[home]', 'community[home]-doc-tree'], [])).toEqual([
      'community[home]',
      'community[home]-doc-tree',
    ])
  })

  it('keeps parent and child tags on the final response header', () => {
    setPublicCacheHeaders(['community[home]'])
    setPublicCacheHeaders([
      'community[home]-thread[POST]-articles',
      'community[home]-thread[POST]-article[42]',
    ])

    expect(responseHeaders.get('cache-tag')).toBe(
      'community[home], community[home]-thread[POST]-articles, community[home]-thread[POST]-article[42]',
    )
    expect(responseHeaders.get('cache-control')).toBe(
      'public, s-maxage=600, stale-while-revalidate=300',
    )
  })
})
