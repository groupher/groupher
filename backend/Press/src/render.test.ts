import { describe, expect, it } from 'vitest'

import { renderAtom, renderJSONFeed, renderLlms, renderRSS, renderSitemap } from './render'
import type { RSSFeed, SiteManifest } from './types'

const feed: RSSFeed = {
  community: {
    publicRef: 'home',
    slug: 'home',
    title: 'Groupher & Friends',
    description: 'A <community>',
    locale: 'en',
    canonicalOrigin: 'https://groupher.com',
    canonicalPath: '/home',
  },
  config: {
    markdownEnabled: true,
    feedEnabled: true,
    feedType: 'digest',
    feedCount: 20,
    feedThreads: ['post'],
    llmsEnabled: true,
    sitemapEnabled: true,
    revision: 1,
  },
  configRevision: 1,
  feedRevision: 'feed-1',
  items: [
    {
      articleRef: 'article-1',
      articleRevision: 'revision-1',
      thread: 'post',
      title: 'A <great> & useful post',
      digest: 'Digest <script>',
      html: '<p>Full</p>',
      canonicalUrl: 'https://groupher.com/home/post/1?x=1&y=2',
      publishedAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-02T10:00:00Z',
      tags: [{ slug: 'release', title: 'Release' }],
    },
  ],
}

describe('Press renderers', () => {
  it('renders escaped RSS with stable content refs as GUIDs', () => {
    const value = renderRSS(feed)
    expect(value).toContain('<guid isPermaLink="false">article-1</guid>')
    expect(value).toContain('A &lt;great&gt; &amp; useful post')
    expect(value).not.toContain('<script>')
  })

  it('renders Atom and JSON Feed from the same DTO', () => {
    expect(renderAtom(feed)).toContain('<id>article-1</id>')
    const json = JSON.parse(renderJSONFeed(feed))
    expect(json.items[0].id).toBe('article-1')
    expect(json.items[0].content_html).toBe('Digest <script>')
  })

  it('renders deterministic agent and sitemap outputs', () => {
    const manifest: SiteManifest = {
      community: feed.community,
      config: feed.config,
      siteRevision: 'site-1',
      threads: ['post'],
      items: feed.items,
    }
    expect(renderLlms(manifest)).toContain(
      '[A &lt;great&gt; &amp; useful post](https://groupher.com/home/post/1?x=1&y=2)',
    )
    expect(renderLlms(manifest)).not.toContain('<script>')
    expect(renderSitemap(manifest)).toContain('x=1&amp;y=2')
  })
})
