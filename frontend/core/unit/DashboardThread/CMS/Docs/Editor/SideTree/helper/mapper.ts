import { SIDE_TREE_NODE_TYPE } from '../constant'
import type { TDocTreeNodeDTO, TSideTreeChild, TSideTreeGroup } from '../spec'

/**
 * Convert a backend page/link node into the local SideTree child shape.
 *
 * @example
 * const child = mapNode(node)
 * child.type === SIDE_TREE_NODE_TYPE.PAGE
 */
export const mapNode = (node: TDocTreeNodeDTO): TSideTreeChild => {
  if (node.type === SIDE_TREE_NODE_TYPE.LINK) {
    return {
      id: node.id,
      type: SIDE_TREE_NODE_TYPE.LINK,
      title: node.title || '',
      slug: node.slug || undefined,
      href: node.href || '',
      marker: node.marker || undefined,
      badge: node.badge || undefined,
      hidden: node.hidden || undefined,
    }
  }

  return {
    id: node.id,
    type: SIDE_TREE_NODE_TYPE.PAGE,
    title: node.title || undefined,
    slug: node.slug || undefined,
    docId: node.docId || undefined,
    path: node.slug || undefined,
    href: undefined,
    marker: node.marker || undefined,
    badge: node.badge || undefined,
    hidden: node.hidden || undefined,
  }
}

/**
 * Convert a backend group node and its children into a local SideTree group.
 *
 * @example
 * const group = mapGroup(node)
 * group.children.every(Boolean)
 */
export const mapGroup = (node: TDocTreeNodeDTO): TSideTreeGroup => ({
  id: node.id,
  type: SIDE_TREE_NODE_TYPE.GROUP,
  title: node.title || '',
  slug: node.slug || undefined,
  marker: node.marker || undefined,
  hidden: node.hidden || undefined,
  expanded: node.expanded ?? true,
  children: (node.children || []).map(mapNode),
})

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
  if (node.type === SIDE_TREE_NODE_TYPE.GROUP) {
    return groups.map((group) => (group.id === node.id ? { ...group, ...mapGroup(node) } : group))
  }

  const child = mapNode(node)

  return groups.map((group) => ({
    ...group,
    children: group.children.map((item) => (item.id === child.id ? child : item)),
  }))
}
