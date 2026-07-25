import { SIDE_TREE_NODE_TYPE } from '../constant'
import type { TDocTreeNodeDTO, TSideTreeChild, TSideTreeGroup, TSideTreePin } from '../spec'
import { isLinkHref } from './url'

const normalizeNodeType = (type: TDocTreeNodeDTO['type'] | string | null | undefined): string =>
  String(type || '').toLowerCase()

const isLinkNode = (node: TDocTreeNodeDTO): boolean => {
  const type = normalizeNodeType(node.type)

  return (
    type === SIDE_TREE_NODE_TYPE.LINK ||
    (type === SIDE_TREE_NODE_TYPE.PAGE && !node.docId && !!node.href && isLinkHref(node.href))
  )
}

/**
 * Convert a backend page/link node into the local SideTree child shape.
 *
 * @example
 * const child = mapNode(node)
 * child.type === SIDE_TREE_NODE_TYPE.PAGE
 */
export const mapNode = (node: TDocTreeNodeDTO): TSideTreeChild => {
  if (isLinkNode(node)) {
    return {
      id: node.id,
      type: SIDE_TREE_NODE_TYPE.LINK,
      title: node.title || '',
      href: node.href || '',
      marker: node.marker || undefined,
      badge: node.badge || undefined,
      hidden: node.hidden || undefined,
      publishState: node.publishState || undefined,
    }
  }

  return {
    id: node.id,
    type: SIDE_TREE_NODE_TYPE.PAGE,
    title: node.title || undefined,
    docId: node.docId || undefined,
    href: undefined,
    marker: node.marker || undefined,
    badge: node.badge || undefined,
    hidden: node.hidden || undefined,
    publishState: node.publishState || undefined,
  }
}

export const mapPin = (node: TDocTreeNodeDTO): TSideTreePin => ({
  id: node.id,
  type: SIDE_TREE_NODE_TYPE.PIN,
  title: node.title || '',
  href: node.href || '',
  marker: node.marker || undefined,
  hidden: node.hidden || undefined,
  publishState: node.publishState || undefined,
})

/**
 * Convert a backend group node and its pages into a local SideTree group.
 *
 * @example
 * const group = mapGroup(node)
 * group.pages.every(Boolean)
 */
export const mapGroup = (node: TDocTreeNodeDTO): TSideTreeGroup => {
  const pages = node.pages || []
  const groups = pages
    .filter((child) => normalizeNodeType(child.type) === SIDE_TREE_NODE_TYPE.GROUP)
    .map(mapGroup)
  const leaves = pages
    .filter((child) => normalizeNodeType(child.type) !== SIDE_TREE_NODE_TYPE.GROUP)
    .map(mapNode)

  return {
    id: node.id,
    parentNodeId: node.parentNodeId || '',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: node.title || '',
    marker: node.marker || undefined,
    hidden: node.hidden || undefined,
    publishState: node.publishState || undefined,
    pages: [...groups, ...leaves],
  }
}

/**
 * Replace a single remote node inside the current local SideTree groups.
 *
 * @example
 * const nextGroups = patchNode(groups, updatedNode)
 * nextGroups !== groups
 */
export const patchNode = (
  groups: readonly TSideTreeGroup[],
  node: TDocTreeNodeDTO,
): TSideTreeGroup[] => {
  if (normalizeNodeType(node.type) === SIDE_TREE_NODE_TYPE.GROUP) {
    return groups.map((group) => {
      if (group.id === node.id) return { ...group, ...mapGroup(node) }

      return {
        ...group,
        pages: group.pages.map((child) =>
          child.type === SIDE_TREE_NODE_TYPE.GROUP ? patchNode([child], node)[0] : child,
        ),
      }
    })
  }

  const child = mapNode(node)

  return groups.map((group) => ({
    ...group,
    pages: group.pages.map((item) =>
      item.type === SIDE_TREE_NODE_TYPE.GROUP
        ? patchNode([item], node)[0]
        : item.id === child.id
          ? child
          : item,
    ),
  }))
}
