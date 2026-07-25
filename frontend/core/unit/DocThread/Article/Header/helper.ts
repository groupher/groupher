import type {
  TDoc,
  TDocPublicTreeGroup,
  TDocPublicTreeItem,
  TDocPublicTreeNavigationNode,
} from '~/spec'

const normalizePath = (path?: string | null): string => {
  if (!path) return ''
  if (path === '/') return path

  return path.endsWith('/') ? path.slice(0, -1) : path
}

const itemMatchesDoc = (item: TDocPublicTreeItem, doc: TDoc, pathname?: string | null): boolean => {
  if (item.docId && doc.id && String(item.docId) === String(doc.id)) return true
  if (item.href && pathname && normalizePath(item.href) === normalizePath(pathname)) return true

  return false
}

export const findCurrentGroup = (
  nodes: readonly TDocPublicTreeNavigationNode[],
  doc: TDoc,
  pathname?: string | null,
): TDocPublicTreeGroup | null => {
  for (const node of nodes) {
    if (String(node.type).toLowerCase() !== 'group') continue
    const group = node as TDocPublicTreeGroup
    const pages = group.pages ?? []
    if (pages.some((item) => itemMatchesDoc(item, doc, pathname))) return group
    const nested = findCurrentGroup(pages, doc, pathname)
    if (nested) return nested
  }

  return null
}
