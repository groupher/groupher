import type { TSideTreeGroup, TSideTreeNavigationNode } from '../spec'
import { SIDE_TREE_DND_LANE } from './constant'
import type { TSideTreeDndLane, TSideTreeDragTarget } from './spec'

type TNodeLocation = {
  node: TSideTreeNavigationNode
  parentNodeId: string
  lane: TSideTreeDndLane
  index: number
}

const isGroup = (node: TSideTreeNavigationNode): node is TSideTreeGroup => node.type === 'group'

export const sideTreeNodeLane = (node: TSideTreeNavigationNode): TSideTreeDndLane =>
  isGroup(node) ? SIDE_TREE_DND_LANE.GROUPS : SIDE_TREE_DND_LANE.LEAVES

const canonicalPages = (pages: readonly TSideTreeNavigationNode[]): TSideTreeNavigationNode[] => {
  const groups: TSideTreeGroup[] = []
  const leaves: TSideTreeNavigationNode[] = []

  for (const page of pages) {
    if (isGroup(page)) {
      groups.push({ ...page, pages: canonicalPages(page.pages) })
    } else {
      leaves.push(page)
    }
  }

  return [...groups, ...leaves]
}

export const canonicalizeSideTreeGroups = (groups: readonly TSideTreeGroup[]): TSideTreeGroup[] =>
  groups.map((group) => ({
    ...group,
    pages: canonicalPages(group.pages),
  }))

const findNodeLocation = (
  groups: readonly TSideTreeGroup[],
  nodeId: string,
  rootParentNodeId: string,
): TNodeLocation | null => {
  for (const [index, group] of groups.entries()) {
    if (group.id === nodeId) {
      return {
        node: group,
        parentNodeId: rootParentNodeId,
        lane: SIDE_TREE_DND_LANE.GROUPS,
        index,
      }
    }

    let groupIndex = 0
    let leafIndex = 0
    for (const page of group.pages) {
      const lane = sideTreeNodeLane(page)
      const pageIndex = lane === SIDE_TREE_DND_LANE.GROUPS ? groupIndex++ : leafIndex++
      if (page.id === nodeId) {
        return { node: page, parentNodeId: group.id, lane, index: pageIndex }
      }
      if (!isGroup(page)) continue

      const nested = findNodeLocation([page], nodeId, group.id)
      if (nested) return nested
    }
  }

  return null
}

const groupContains = (group: TSideTreeGroup, nodeId: string): boolean =>
  group.pages.some((page) => page.id === nodeId || (isGroup(page) && groupContains(page, nodeId)))

const removeNode = (
  groups: readonly TSideTreeGroup[],
  nodeId: string,
): { groups: TSideTreeGroup[]; node: TSideTreeNavigationNode | null } => {
  let removed: TSideTreeNavigationNode | null = null
  const nextGroups: TSideTreeGroup[] = []

  for (const group of groups) {
    if (group.id === nodeId) {
      removed = group
      continue
    }

    const pages: TSideTreeNavigationNode[] = []
    for (const page of group.pages) {
      if (page.id === nodeId) {
        removed = page
        continue
      }

      if (isGroup(page)) {
        const nested = removeNode([page], nodeId)
        if (nested.node) {
          removed = nested.node
          pages.push(...nested.groups)
          continue
        }
      }

      pages.push(page)
    }

    nextGroups.push({ ...group, pages: canonicalPages(pages) })
  }

  return { groups: nextGroups, node: removed }
}

const insertNode = (
  groups: readonly TSideTreeGroup[],
  parentNodeId: string,
  targetLane: TSideTreeDndLane,
  index: number,
  node: TSideTreeNavigationNode,
  rootParentNodeId: string,
): TSideTreeGroup[] | null => {
  if (parentNodeId === rootParentNodeId) {
    if (!isGroup(node) || targetLane !== SIDE_TREE_DND_LANE.GROUPS) return null

    const nextGroups = [...groups]
    nextGroups.splice(Math.max(0, Math.min(index, nextGroups.length)), 0, {
      ...node,
      parentNodeId: rootParentNodeId,
    })
    return nextGroups
  }

  let inserted = false
  const nextGroups = groups.map((group) => {
    if (group.id === parentNodeId) {
      inserted = true
      const groupPages = group.pages.filter(isGroup)
      const leafPages = group.pages.filter((page) => !isGroup(page))
      const movedNode = isGroup(node) ? { ...node, parentNodeId: group.id } : node
      if (targetLane === SIDE_TREE_DND_LANE.GROUPS && isGroup(movedNode)) {
        groupPages.splice(Math.max(0, Math.min(index, groupPages.length)), 0, movedNode)
      } else if (targetLane === SIDE_TREE_DND_LANE.LEAVES && !isGroup(movedNode)) {
        leafPages.splice(Math.max(0, Math.min(index, leafPages.length)), 0, movedNode)
      } else {
        return group
      }
      return { ...group, pages: [...groupPages, ...leafPages] }
    }

    const nestedGroups = group.pages.filter(isGroup)
    if (nestedGroups.length === 0) return group

    const nextNestedGroups = insertNode(
      nestedGroups,
      parentNodeId,
      targetLane,
      index,
      node,
      rootParentNodeId,
    )
    if (!nextNestedGroups) return group

    inserted = true
    const nestedById = new Map(nextNestedGroups.map((nested) => [nested.id, nested]))
    return {
      ...group,
      pages: canonicalPages(
        group.pages.map((page) => (isGroup(page) ? nestedById.get(page.id) || page : page)),
      ),
    }
  })

  return inserted ? nextGroups : null
}

export const moveSideTreeNode = (
  groups: readonly TSideTreeGroup[],
  nodeId: string,
  target: TSideTreeDragTarget,
  rootParentNodeId: string,
): TSideTreeGroup[] => {
  const source = findNodeLocation(groups, nodeId, rootParentNodeId)
  if (!source || target.overNodeId === nodeId) return [...groups]
  if (source.lane !== target.lane) return [...groups]
  if (!isGroup(source.node) && target.parentNodeId === rootParentNodeId) return [...groups]
  if (
    isGroup(source.node) &&
    (target.parentNodeId === source.node.id || groupContains(source.node, target.parentNodeId))
  ) {
    return [...groups]
  }

  const nextIndex =
    source.parentNodeId === target.parentNodeId &&
    source.lane === target.lane &&
    source.index < target.index
      ? target.index - 1
      : target.index
  if (source.parentNodeId === target.parentNodeId && source.index === nextIndex) return [...groups]

  const removed = removeNode(canonicalizeSideTreeGroups(groups), nodeId)
  if (!removed.node) return [...groups]

  return (
    insertNode(
      removed.groups,
      target.parentNodeId,
      target.lane,
      nextIndex,
      removed.node,
      rootParentNodeId,
    ) || [...groups]
  )
}

export const sideTreeGroupSubtreeIds = (
  groups: readonly TSideTreeGroup[],
  groupId: string,
): ReadonlySet<string> => {
  const ids = new Set<string>()

  const collect = (group: TSideTreeGroup): boolean => {
    if (group.id === groupId) {
      const addSubtree = (node: TSideTreeGroup): void => {
        ids.add(node.id)
        for (const page of node.pages) {
          if (isGroup(page)) addSubtree(page)
        }
      }
      addSubtree(group)
      return true
    }

    return group.pages.some((page) => isGroup(page) && collect(page))
  }

  groups.some(collect)
  return ids
}

export const sameSideTreeGroups = (
  left: readonly TSideTreeGroup[],
  right: readonly TSideTreeGroup[],
): boolean => JSON.stringify(left) === JSON.stringify(right)
