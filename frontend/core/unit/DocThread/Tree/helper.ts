import { DEFAULT_GROUP_MARKER, DEFAULT_LINK_MARKER, DEFAULT_PAGE_MARKER } from '~/const/marker'
import type {
  TDocPublicTreeGroup,
  TDocPublicTreeItem,
  TDocPublicTreeNavigationNode,
  TMarkerValue,
} from '~/spec'

/** Normalizes node type into the canonical frontend shared shape. */
export const normalizeNodeType = (type?: string | null): string => (type || '').toLowerCase()

/** Runs the collect group ids operation at the frontend shared boundary. */
export const collectGroupIds = (
  nodes: readonly TDocPublicTreeNavigationNode[],
): readonly string[] => {
  const groupIds: string[] = []

  for (const node of nodes) {
    if (normalizeNodeType(node.type) !== 'group') continue

    const group = node as TDocPublicTreeGroup
    groupIds.push(group.id, ...collectGroupIds(group.pages ?? []))
  }

  return groupIds
}

/** Reports whether link node at the frontend shared boundary. */
export const isLinkNode = (item: TDocPublicTreeItem): boolean =>
  normalizeNodeType(item.type) === 'link'

/** Reports whether external href at the frontend shared boundary. */
export const isExternalHref = (href?: string | null): boolean => {
  if (!href) return false

  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:')
}

const normalizePath = (path?: string | null): string => {
  if (!path) return ''
  if (path === '/') return path

  return path.endsWith('/') ? path.slice(0, -1) : path
}

/** Reports whether active href at the frontend shared boundary. */
export const isActiveHref = (pathname: string | null, href?: string | null): boolean => {
  if (!pathname || !href || isExternalHref(href)) return false

  return normalizePath(pathname) === normalizePath(href)
}

/** Returns node href for the frontend shared workflow. */
export const getNodeHref = (item: TDocPublicTreeItem): string => item.href || '#'

/** Returns node marker for the frontend shared workflow. */
export const getNodeMarker = (item: TDocPublicTreeItem): TMarkerValue => {
  if (item.marker) return item.marker
  if (normalizeNodeType(item.type) === 'group') return DEFAULT_GROUP_MARKER
  if (isLinkNode(item)) return DEFAULT_LINK_MARKER

  return DEFAULT_PAGE_MARKER
}

/** Runs the filter tree nodes operation at the frontend shared boundary. */
export const filterTreeNodes = (
  nodes: readonly TDocPublicTreeNavigationNode[],
  query: string,
): readonly TDocPublicTreeNavigationNode[] => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return nodes

  const filteredNodes: TDocPublicTreeNavigationNode[] = []

  nodes.forEach((node) => {
    const matched = (node.title || '').toLowerCase().includes(normalizedQuery)
    const group = normalizeNodeType(node.type) === 'group' ? (node as TDocPublicTreeGroup) : null
    const matchedChildren = group ? filterTreeNodes(group.pages ?? [], query) : []

    if (!matched && matchedChildren.length === 0) return

    filteredNodes.push(
      group
        ? {
            ...group,
            pages: matched ? group.pages : matchedChildren,
          }
        : node,
    )
  })

  return filteredNodes
}
