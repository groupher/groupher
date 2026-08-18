/**
 * Implements the Src Render boundary inside Press.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Press module
 *     -> cache / Phoenix projection
 *     -> public response
 */

import type { FeedItem, RSSFeed, SiteManifest } from './types'

const xml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const rfc822 = (value: string): string => new Date(value).toUTCString()

const markdownText = (value: unknown): string =>
  String(value ?? '')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(/([\\`*{}[\]()#+.!_|-])/g, '\\$1')

const itemContent = (feed: RSSFeed, item: FeedItem): string =>
  feed.config.feedType === 'full' ? item.html || item.digest || '' : item.digest || ''

/** Runs the render rss operation at the press boundary. */
export const renderRSS = (feed: RSSFeed): string => {
  const home = `${feed.community.canonicalOrigin}${feed.community.canonicalPath}`
  const items = feed.items
    .map(
      (item) => `<item>
<title>${xml(item.title)}</title>
<link>${xml(item.canonicalUrl)}</link>
<guid isPermaLink="false">${xml(item.articleRef)}</guid>
<pubDate>${xml(rfc822(item.publishedAt))}</pubDate>
<description>${xml(itemContent(feed, item))}</description>
</item>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${xml(feed.community.title)}</title>
<link>${xml(home)}</link>
<description>${xml(feed.community.description || feed.community.title)}</description>
<language>${xml(feed.community.locale)}</language>
${items}
</channel></rss>\n`
}

/** Runs the render atom operation at the press boundary. */
export const renderAtom = (feed: RSSFeed): string => {
  const home = `${feed.community.canonicalOrigin}${feed.community.canonicalPath}`
  const updated =
    feed.items[0]?.updatedAt || feed.items[0]?.publishedAt || new Date(0).toISOString()
  const entries = feed.items
    .map(
      (item) =>
        `<entry><id>${xml(item.articleRef)}</id><title>${xml(item.title)}</title><link href="${xml(item.canonicalUrl)}"/><published>${xml(item.publishedAt)}</published><updated>${xml(item.updatedAt)}</updated><content type="html">${xml(itemContent(feed, item))}</content></entry>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><id>${xml(home)}</id><title>${xml(feed.community.title)}</title><updated>${xml(updated)}</updated><link href="${xml(home)}"/>${entries}</feed>\n`
}

/** Runs the render jsonfeed operation at the press boundary. */
export const renderJSONFeed = (feed: RSSFeed): string =>
  `${JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: feed.community.title,
    home_page_url: `${feed.community.canonicalOrigin}${feed.community.canonicalPath}`,
    description: feed.community.description,
    language: feed.community.locale,
    items: feed.items.map((item) => ({
      id: item.articleRef,
      url: item.canonicalUrl,
      title: item.title,
      content_html: itemContent(feed, item),
      date_published: item.publishedAt,
      date_modified: item.updatedAt,
      authors: item.author
        ? [
            {
              name: item.author.name,
              url: item.author.login
                ? `${feed.community.canonicalOrigin}/u/${item.author.login}`
                : undefined,
            },
          ]
        : undefined,
      tags: item.tags.map((tag) => tag.title),
    })),
  })}\n`

/** Runs the render llms operation at the press boundary. */
export const renderLlms = (manifest: SiteManifest): string => {
  const lines = [`# ${markdownText(manifest.community.title)}`]
  if (manifest.community.description)
    lines.push('', `> ${markdownText(manifest.community.description)}`)
  lines.push('', '## Content')
  for (const item of manifest.items)
    lines.push(
      `- [${markdownText(item.title)}](${item.canonicalUrl}) — ${markdownText(item.digest || item.thread)}`,
    )
  return `${lines.join('\n')}\n`
}

/** Runs the render sitemap operation at the press boundary. */
export const renderSitemap = (manifest: SiteManifest): string => {
  const urls = manifest.items
    .map(
      (item) =>
        `<url><loc>${xml(item.canonicalUrl)}</loc><lastmod>${xml(item.updatedAt)}</lastmod></url>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`
}
