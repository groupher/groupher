import { describe, expect, it } from 'vitest'

import { communityPublicPath, isCommunityPathContextTrusted } from './public-path'

describe('community public path context', () => {
  it('requires the rewritten path to carry the trusted community slug', () => {
    expect(isCommunityPathContextTrusted('/home/post/123', 'home')).toBe(true)
    expect(isCommunityPathContextTrusted('/post/123', 'home')).toBe(false)
    expect(isCommunityPathContextTrusted('/other/post/123', 'home')).toBe(false)
  })

  it('removes the internal slug only for custom-domain paths', () => {
    expect(communityPublicPath('home', '/post/123', true)).toBe('/post/123')
    expect(communityPublicPath('home', '/post/123', false)).toBe('/home/post/123')
  })
})
