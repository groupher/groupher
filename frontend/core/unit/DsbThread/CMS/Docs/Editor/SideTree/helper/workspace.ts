import { ARTICLE_STAGE } from '~/const/article'

import { SIDE_TREE_NODE_TYPE } from '../constant'
import type { TSideTreeGroup, TSideTreeNavigationNode, TSideTreeTab, TWorkspaceNode } from '../spec'

/** Projects the flat workspace directory into the editor's nested navigation. */
export const workspaceTabs = (
  nodes: readonly TWorkspaceNode[],
  queuedIds: ReadonlySet<string> = new Set(),
): TSideTreeTab[] => {
  const byParent = new Map<string | null, TWorkspaceNode[]>()
  for (const node of nodes) {
    const parent = node.parentNodeId ?? null
    byParent.set(parent, [...(byParent.get(parent) ?? []), node])
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.index - b.index)

  const group = (node: TWorkspaceNode): TSideTreeGroup => ({
    id: node.nodeId,
    parentNodeId: node.parentNodeId ?? '',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: node.title,
    marker: node.marker ?? undefined,
    hidden: node.hidden,
    pages: (byParent.get(node.nodeId) ?? []).map(navigation),
  })
  const navigation = (node: TWorkspaceNode): TSideTreeNavigationNode => {
    if (node.type === 'GROUP') return group(node)
    if (node.type === 'LINK')
      return {
        id: node.nodeId,
        type: SIDE_TREE_NODE_TYPE.LINK,
        title: node.title,
        href: node.href ?? '',
        marker: node.marker ?? undefined,
        badge: node.badge ?? undefined,
        hidden: node.hidden,
      }
    return {
      id: node.nodeId,
      type: SIDE_TREE_NODE_TYPE.PAGE,
      title: node.title,
      docId: node.docId,
      workingCopyId: node.workingCopyId,
      workingCopyRevision: node.workingCopyRevision,
      publishState: {
        queued: !!node.docId && queuedIds.has(node.docId),
        published: node.published,
        hasDraft: !node.published,
        status: node.published ? ARTICLE_STAGE.PUBLIC : ARTICLE_STAGE.DRAFT,
      },
      marker: node.marker ?? undefined,
      badge: node.badge ?? undefined,
      hidden: node.hidden,
    }
  }

  return (byParent.get(null) ?? [])
    .filter((node) => node.type === 'TAB')
    .map((tab) => {
      const children = byParent.get(tab.nodeId) ?? []
      return {
        id: tab.nodeId,
        title: tab.title,
        groups: children.filter((node) => node.type === 'GROUP').map(group),
        pins: children
          .filter((node) => node.type === 'PIN')
          .map((node) => ({
            id: node.nodeId,
            type: SIDE_TREE_NODE_TYPE.PIN,
            title: node.title,
            href: node.href ?? '',
            marker: node.marker ?? undefined,
            hidden: node.hidden,
          })),
      }
    })
}
