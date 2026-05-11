import type { TResolvedHeaderLinkItem } from '~/spec'

const normalizeUrl = (url = ''): string => url.replace(/\/$/, '')

export const isLinkVisible = (title: string, url: string): boolean =>
  title.trim() !== '' && url.trim() !== ''

export const filterVisibleHeaderLinks = (
  links: readonly TResolvedHeaderLinkItem[],
): readonly TResolvedHeaderLinkItem[] => {
  return links.flatMap((item): TResolvedHeaderLinkItem[] => {
    if (item.type === 'LINK') {
      return isLinkVisible(item.title, item.url) ? [item] : []
    }

    const visibleLinks = item.links.filter((link) => isLinkVisible(link.title, link.url))

    return item.title.trim() !== '' && visibleLinks.length > 0
      ? [{ ...item, links: visibleLinks }]
      : []
  })
}

export const isHeaderLinkActive = (slug: string, activePath: string, url: string): boolean => {
  const currentUrl = activePath ? `/${slug}/${activePath}` : `/${slug}`

  return normalizeUrl(currentUrl) === normalizeUrl(url)
}
