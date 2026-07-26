import type { TPublicService, TServiceMetricsSnapshot, TServiceStartMode } from '@shared/contracts'
import type { Edge, Node, NodeProps, XYPosition } from '@xyflow/react'

export type TFlowServiceNodeData = Record<string, unknown> & {
  service: TPublicService
  metrics?: TServiceMetricsSnapshot
  expanded: boolean
  compact: boolean
  pending: boolean
  incomingRelationIds: string[]
  outgoingRelationIds: string[]
  onToggleService: (service: TPublicService) => void
  onStartService: (service: TPublicService, mode: TServiceStartMode | 'default') => void
  onRestartService: (service: TPublicService) => void
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
  onOpenConfig: (id: string) => void
  onOpenDependencies: (id: string) => void
}

export type TFlowServiceNode = Node<TFlowServiceNodeData, 'service'>

export type TFlowLaneNoteData = Record<string, unknown> & {
  title: string
  detail: string
}

export type TFlowLaneNoteNode = Node<TFlowLaneNoteData, 'lane-note'>
export type TFlowUsersNodeData = Record<string, unknown> & {
  outgoingRelationId: string
}

export type TFlowUsersNode = Node<TFlowUsersNodeData, 'users'>
export type TFlowNode = TFlowServiceNode | TFlowLaneNoteNode | TFlowUsersNode
export type TFlowNodeProps = NodeProps<TFlowServiceNode>

export type TFlowEdgeData = Record<string, unknown> & {
  live: boolean
  laneOffset: number
  relationId: string
  sourceId: string
  targetId: string
}

export type TFlowEdge = Edge<TFlowEdgeData, 'relation'>

export type TFlowLayout = {
  positions: Record<string, XYPosition>
  laneNotePosition: XYPosition | null
}
