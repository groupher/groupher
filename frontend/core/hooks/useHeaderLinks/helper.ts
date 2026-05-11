import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import { ROUTE } from '~/const/route'
import type { THeaderLinkChild, THeaderLinkItem, TResolvedHeaderLinkItem } from '~/spec'

export const SYSTEM_MORE_ID = 'system:more'
export const SYSTEM_ABOUT_ID = 'system:about'
export const SYSTEM_DASHBOARD_ID = 'system:dashboard'
export const CUSTOM_MORE_ID = 'custom:more'

export const getAboutPath = (community: string): string => `/${community}/${ROUTE.ABOUT}`
export const getDashboardPath = (community: string): string => `/${community}/dashboard`

type TLegacyHeaderLinkItem = {
  id?: string
  type?: string
  title?: string
  url?: string
  link?: string
  group?: string
  groupIndex?: number
  index?: number
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

const normalizeType = (type?: string): 'LINK' | 'GROUP' | null => {
  if (!type) return null

  const normalized = type.toUpperCase()
  return normalized === 'LINK' || normalized === 'GROUP' ? normalized : null
}

export const normalizeUrl = (url = ''): string => url.replace(/\/$/, '')

const isSystemUrl = (url: string, community: string): boolean => {
  const normalized = normalizeUrl(url)

  return (
    normalized === normalizeUrl(getAboutPath(community)) ||
    normalized === normalizeUrl(getDashboardPath(community))
  )
}

const isSystemChild = (link: Pick<TLegacyHeaderLinkItem, 'link' | 'url'>, community: string) =>
  isSystemUrl(link.url || link.link || '', community)

const isSystemGroup = (group: string): boolean =>
  group === MORE_GROUP || group === '更多' || group === '关于' || group === 'About'

export const isCustomMoreGroup = (
  item:
    | Pick<THeaderLinkItem, 'id' | 'title' | 'type'>
    | Pick<TLegacyHeaderLinkItem, 'id' | 'title'>,
): boolean => item.id === CUSTOM_MORE_ID || item.title === '更多' || item.title === MORE_GROUP

const customMoreTitle = (
  item:
    | Pick<THeaderLinkItem, 'id' | 'title' | 'type'>
    | Pick<TLegacyHeaderLinkItem, 'id' | 'title'>,
): string => (isCustomMoreGroup(item) ? '更多' : item.title || '')

const normalizeStructuredLinks = (
  links: readonly TLegacyHeaderLinkItem[],
  community: string,
): readonly THeaderLinkItem[] => {
  return links.flatMap((item, index): THeaderLinkItem[] => {
    const type = normalizeType(item.type) ?? (item.links ? 'GROUP' : 'LINK')
    const id = item.id || legacyId('header', index, item.title)

    if (type === 'LINK') {
      const url = item.url || item.link || ''
      if (isSystemUrl(url, community)) return []

      return [{ id, type: 'LINK', title: item.title || '', url }]
    }

    const children = (item.links || [])
      .filter((link) => !isSystemChild(link, community))
      .map((link, linkIndex) => ({
        id: link.id || legacyId('header-child', index, linkIndex, link.title),
        title: link.title || '',
        url: link.url || link.link || '',
      }))

    if (isSystemGroup(item.title || '') && children.length === 0) return []

    return [
      {
        id: isCustomMoreGroup(item) ? CUSTOM_MORE_ID : id,
        type: 'GROUP',
        title: customMoreTitle(item),
        links: children,
      },
    ]
  })
}

const normalizeLegacyFlatLinks = (
  links: readonly TLegacyHeaderLinkItem[],
  community: string,
): readonly THeaderLinkItem[] => {
  const groups = new Map<string, TLegacyHeaderLinkItem[]>()

  for (const item of links) {
    if (!item.group || isSystemChild(item, community)) continue
    if (isSystemGroup(item.group) && item.group !== MORE_GROUP && item.group !== '更多') continue
    groups.set(item.group, [...(groups.get(item.group) || []), item])
  }

  return Array.from(groups.entries())
    .map(([group, items]) => ({
      group,
      groupIndex: items[0]?.groupIndex ?? 0,
      items: [...items].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)),
    }))
    .sort((a, b) => a.groupIndex - b.groupIndex)
    .flatMap(({ group, groupIndex, items }): THeaderLinkItem[] => {
      if (group.startsWith(ONE_LINK_GROUP)) {
        const item = items[0]

        return [
          {
            id: item.id || legacyId('header-link', groupIndex, item.index, item.title),
            type: 'LINK',
            title: item.title || '',
            url: item.url || item.link || '',
          },
        ]
      }

      if (group === MORE_GROUP || group === '更多') {
        return [
          {
            id: CUSTOM_MORE_ID,
            type: 'GROUP',
            title: '更多',
            links: items.map((item) => ({
              id: item.id || legacyId('header-child', groupIndex, item.index, item.title),
              title: item.title || '',
              url: item.url || item.link || '',
            })),
          },
        ]
      }

      return [
        {
          id: legacyId('header-group', groupIndex, group),
          type: 'GROUP',
          title: group,
          links: items.map((item) => ({
            id: item.id || legacyId('header-child', groupIndex, item.index, item.title),
            title: item.title || '',
            url: item.url || item.link || '',
          })),
        },
      ]
    })
}

export const normalizeHeaderLinks = (
  links: readonly THeaderLinkItem[] | readonly TLegacyHeaderLinkItem[],
  community: string,
): readonly THeaderLinkItem[] => {
  const legacyLinks = links as readonly TLegacyHeaderLinkItem[]
  const hasLegacyFlatShape = legacyLinks.some((item) => item.group || item.link)

  return hasLegacyFlatShape
    ? normalizeLegacyFlatLinks(legacyLinks, community)
    : normalizeStructuredLinks(legacyLinks, community)
}

export const hasCustomHeaderItems = (links: readonly THeaderLinkItem[]): boolean =>
  links.some((item) => item.title.trim() !== '')

const asSystemLink = (id: string, title: string, url: string): THeaderLinkChild => ({
  id,
  title,
  url,
})

export const shouldFoldAboutToMore = (links: readonly THeaderLinkItem[]): boolean =>
  hasCustomHeaderItems(links)

export const resolveHeaderLinks = (
  links: readonly THeaderLinkItem[],
  community: string,
  isModerator = false,
): readonly TResolvedHeaderLinkItem[] => {
  const customLinks = normalizeHeaderLinks(links, community)
  const customMore = customLinks.find((item) => item.type === 'GROUP' && isCustomMoreGroup(item))
  const visibleCustomLinks = customLinks.filter((item) => item !== customMore)
  const systemLinks: THeaderLinkChild[] = []

  if (shouldFoldAboutToMore(customLinks)) {
    systemLinks.push(asSystemLink(SYSTEM_ABOUT_ID, '关于', getAboutPath(community)))
  }

  if (isModerator) {
    systemLinks.push(asSystemLink(SYSTEM_DASHBOARD_ID, '控制台', getDashboardPath(community)))
  }

  if (!customMore && systemLinks.length === 0) return customLinks

  return [
    ...visibleCustomLinks,
    {
      id: SYSTEM_MORE_ID,
      type: 'system-group',
      title: '更多',
      links: [...(customMore?.links || []), ...systemLinks],
    },
  ]
}
