import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import { MORE_TAB } from '~/hooks/useHeaderLinks/constant'
import { isMoreTabGroup } from '~/hooks/useHeaderLinks/helper'
import type { TLinkChild, TResolvedHeaderLinkItem, TTransKey } from '~/spec'

const normalizeUrl = (url = ''): string => url.replace(/\/$/, '')

const isLinkVisible = (title: string, url: string): boolean =>
  title.trim() !== '' && url.trim() !== ''

export const filterVisibleHeaderLinks = (
  links: readonly TResolvedHeaderLinkItem[],
): readonly TResolvedHeaderLinkItem[] => {
  return links.flatMap((item): TResolvedHeaderLinkItem[] => {
    if (item.type === DASHBOARD_LINK_TYPE.LINK) {
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

export const moreTabTitle = (
  item: TResolvedHeaderLinkItem,
  t: (key: TTransKey) => string,
): string => (isMoreTabGroup(item) ? t(MORE_TAB.TITLE_KEY) : item.title)

export const moreTabLinkTitle = (link: TLinkChild, t: (key: TTransKey) => string): string => {
  if (link.id === MORE_TAB.ABOUT_ID) return t(MORE_TAB.ABOUT_TITLE_KEY)
  if (link.id === MORE_TAB.DASHBOARD_ID) return t(MORE_TAB.DASHBOARD_TITLE_KEY)

  return link.title
}
