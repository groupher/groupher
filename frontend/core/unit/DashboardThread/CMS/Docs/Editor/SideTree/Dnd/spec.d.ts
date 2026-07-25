import type { TSideTreeNodeType } from '../spec'
import type { SIDE_TREE_DND_LANE } from './constant'

export type TSideTreeDropIntent = 'before' | 'after' | 'inside'
export type TSideTreeDndLane = (typeof SIDE_TREE_DND_LANE)[keyof typeof SIDE_TREE_DND_LANE]

export type TSideTreeDragTarget = {
  parentNodeId: string
  lane: TSideTreeDndLane
  index: number
  intent: TSideTreeDropIntent
  overNodeId?: string | null
}

export type TSideTreeNodeDragData = {
  type: 'docs-side-tree-node'
  nodeId: string
  nodeType: TSideTreeNodeType
  parentNodeId: string
  lane: TSideTreeDndLane
  index: number
  depth: number
  childGroupCount: number
  childLeafCount: number
  getRect?: () => DOMRect | undefined
}

export type TSideTreeContainerDragData = {
  type: 'docs-side-tree-container'
  parentNodeId: string
  lane: TSideTreeDndLane
  index: number
  depth: number
}

export type TSideTreeDragData = TSideTreeNodeDragData | TSideTreeContainerDragData
