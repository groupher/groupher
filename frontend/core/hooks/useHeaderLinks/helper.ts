import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import { ROUTE } from '~/const/route'
import type { TLinkChild, TLinkItem, TResolvedHeaderLinkItem } from '~/spec'

import { MORE_TAB } from './constant'

export const getAboutPath = (community: string): string => `/${community}/${ROUTE.ABOUT}`
export const getDashboardPath = (community: string): string => `/${community}/dashboard`

type TLegacyHeaderLinkItem = {
  id?: string
  type?: string
  title?: string
  url?: string
  link?: string
  group?: string
  links?: readonly TLegacyHeaderLinkItem[]
}

const legacyId = (prefix: string, ...parts: Array<number | string | undefined>): string => {
  const body = parts
    .filter((part) => part !== undefined && part !== '')
    .join('-')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return body ? `${prefix}-${body}` : prefix
}

type TCustomHeaderLinkType = typeof DASHBOARD_LINK_TYPE.LINK | typeof DASHBOARD_LINK_TYPE.GROUP

type TMoreTabLinkItem = Extract<TResolvedHeaderLinkItem, { usage: typeof MORE_TAB.USAGE }>

export const isMoreTabGroup = (item: TResolvedHeaderLinkItem): item is TMoreTabLinkItem =>
  item.type === DASHBOARD_LINK_TYPE.GROUP && 'usage' in item && item.usage === MORE_TAB.USAGE

const normalizeType = (type?: string): TCustomHeaderLinkType | null => {
  if (!type) return null

  const normalized = type.toUpperCase()
  return normalized === DASHBOARD_LINK_TYPE.LINK || normalized === DASHBOARD_LINK_TYPE.GROUP
    ? normalized
    : null
}

export const normalizeUrl = (url = ''): string => url.replace(/\/$/, '')

const isMoreTabFixedUrl = (url: string, community: string): boolean => {
  const normalized = normalizeUrl(url)

  return (
    normalized === normalizeUrl(getAboutPath(community)) ||
    normalized === normalizeUrl(getDashboardPath(community))
  )
}

const isMoreTabFixedChild = (
  link: Pick<TLegacyHeaderLinkItem, 'link' | 'url'>,
  community: string,
) => isMoreTabFixedUrl(link.url || link.link || '', community)

export const isCustomMoreGroup = (
  item: Pick<TLinkItem, 'id' | 'title' | 'type'> | Pick<TLegacyHeaderLinkItem, 'id' | 'title'>,
): boolean => item.id === MORE_TAB.CUSTOM_ID

const customMoreTitle = (
  item: Pick<TLinkItem, 'id' | 'title' | 'type'> | Pick<TLegacyHeaderLinkItem, 'id' | 'title'>,
): string => (isCustomMoreGroup(item) ? MORE_TAB.TITLE_KEY : item.title || '')

const normalizeStructuredLinks = (
  links: readonly TLegacyHeaderLinkItem[],
  community: string,
): readonly TLinkItem[] => {
  return links.flatMap((item, index): TLinkItem[] => {
    const type =
      normalizeType(item.type) ??
      (item.links ? DASHBOARD_LINK_TYPE.GROUP : DASHBOARD_LINK_TYPE.LINK)
    const id = item.id || legacyId('header', index, item.title)

    if (type === DASHBOARD_LINK_TYPE.LINK) {
      const url = item.url || item.link || ''
      if (isMoreTabFixedUrl(url, community)) return []

      return [{ id, type: DASHBOARD_LINK_TYPE.LINK, title: item.title || '', url }]
    }

    const children = (item.links || [])
      .filter((link) => !isMoreTabFixedChild(link, community))
      .map((link, linkIndex) => ({
        id: link.id || legacyId('header-child', index, linkIndex, link.title),
        title: link.title || '',
        url: link.url || link.link || '',
      }))

    return [
      {
        id: isCustomMoreGroup(item) ? MORE_TAB.CUSTOM_ID : id,
        type: DASHBOARD_LINK_TYPE.GROUP,
        title: customMoreTitle(item),
        links: children,
      },
    ]
  })
}

export const normalizeHeaderLinks = (
  links: readonly TLinkItem[] | readonly TLegacyHeaderLinkItem[],
  community: string,
): readonly TLinkItem[] => {
  const legacyLinks = links as readonly TLegacyHeaderLinkItem[]
  const hasLegacyFlatShape = legacyLinks.some((item) => item.group || item.link)

  // Old flat header-link records are intentionally ignored instead of being
  // migrated in the resolver. New writes should only use TLinkItem.
  return hasLegacyFlatShape ? [] : normalizeStructuredLinks(legacyLinks, community)
}

export const hasCustomHeaderItems = (links: readonly TLinkItem[]): boolean =>
  links.some((item) => {
    if (item.type === DASHBOARD_LINK_TYPE.LINK) return item.title.trim() !== ''
    if (isCustomMoreGroup(item)) return item.links.some((link) => link.title.trim() !== '')

    return item.title.trim() !== '' || item.links.some((link) => link.title.trim() !== '')
  })

const asMoreTabLink = (id: string, title: string, url: string): TLinkChild => ({
  id,
  title,
  url,
})

export const shouldFoldAboutToMore = (links: readonly TLinkItem[]): boolean =>
  hasCustomHeaderItems(links)

export const resolveHeaderLinks = (
  links: readonly TLinkItem[],
  community: string,
  isModerator = false,
): readonly TResolvedHeaderLinkItem[] => {
  const customLinks = normalizeHeaderLinks(links, community)
  const customMore = customLinks.find(
    (item) => item.type === DASHBOARD_LINK_TYPE.GROUP && isCustomMoreGroup(item),
  )
  const visibleCustomLinks = customLinks.filter((item) => item !== customMore)
  const moreTabLinks: TLinkChild[] = []

  if (shouldFoldAboutToMore(customLinks)) {
    moreTabLinks.push(
      asMoreTabLink(MORE_TAB.ABOUT_ID, MORE_TAB.ABOUT_TITLE_KEY, getAboutPath(community)),
    )
  }

  if (isModerator) {
    moreTabLinks.push(
      asMoreTabLink(
        MORE_TAB.DASHBOARD_ID,
        MORE_TAB.DASHBOARD_TITLE_KEY,
        getDashboardPath(community),
      ),
    )
  }

  if (!customMore && moreTabLinks.length === 0) return customLinks
  if ((customMore?.links.length || 0) === 0 && moreTabLinks.length === 0) return visibleCustomLinks

  return [
    ...visibleCustomLinks,
    {
      id: MORE_TAB.ID,
      type: DASHBOARD_LINK_TYPE.GROUP,
      // usage marks this resolved group as the rendered More tab. It is never
      // persisted back into dashboard.headerLinks.
      usage: MORE_TAB.USAGE,
      title: MORE_TAB.TITLE_KEY,
      links: [...(customMore?.links || []), ...moreTabLinks],
    },
  ]
}
