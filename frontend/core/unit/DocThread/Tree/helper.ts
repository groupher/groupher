import { DEFAULT_GROUP_MARKER, DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER } from '~/const/marker'
import type { TDocPublicTreeGroup, TDocPublicTreeItem, TMarkerValue } from '~/spec'

export const normalizeNodeType = (type?: string | null): string => (type || '').toLowerCase()

export const isLinkNode = (item: TDocPublicTreeItem): boolean =>
  normalizeNodeType(item.type) === 'link'

export const isExternalHref = (href?: string | null): boolean => {
  if (!href) return false

  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:')
}

const normalizePath = (path?: string | null): string => {
  if (!path) return ''
  if (path === '/') return path

  return path.endsWith('/') ? path.slice(0, -1) : path
}

export const isActiveHref = (pathname: string | null, href?: string | null): boolean => {
  if (!pathname || !href || isExternalHref(href)) return false

  return normalizePath(pathname) === normalizePath(href)
}

export const getNodeHref = (item: TDocPublicTreeItem): string => item.href || '#'

export const getNodeMarker = (item: TDocPublicTreeItem): TMarkerValue => {
  if (item.marker) return item.marker
  if (normalizeNodeType(item.type) === 'group') return DEFAULT_GROUP_MARKER
  if (isLinkNode(item)) return DEFAULT_LINK_MARKER

  return DEFAULT_PAGE_MARKER
}

export const filterTreeGroups = (
  groups: readonly TDocPublicTreeGroup[],
  query: string,
): readonly TDocPublicTreeGroup[] => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return groups

  const filteredGroups: TDocPublicTreeGroup[] = []

  groups.forEach((group) => {
    const groupMatched = (group.title || '').toLowerCase().includes(normalizedQuery)
    const children = group.children ?? []
    const matchedChildren = children.filter((child) =>
      (child.title || '').toLowerCase().includes(normalizedQuery),
    )

    if (!groupMatched && matchedChildren.length === 0) return

    filteredGroups.push({
      ...group,
      children: groupMatched ? children : matchedChildren,
    })
  })

  return filteredGroups
}
