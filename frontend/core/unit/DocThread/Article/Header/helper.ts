import type { TDoc, TDocPublicTreeGroup, TDocPublicTreeItem } from '~/spec'

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
  groups: readonly TDocPublicTreeGroup[],
  doc: TDoc,
  pathname?: string | null,
): TDocPublicTreeGroup | null => {
  for (const group of groups) {
    if (itemMatchesDoc(group, doc, pathname)) return group

    const children = group.children ?? []
    if (children.some((item) => itemMatchesDoc(item, doc, pathname))) return group
  }

  return null
}
