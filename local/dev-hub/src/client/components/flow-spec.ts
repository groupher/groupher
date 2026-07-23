import type { TPublicService, TServiceMetricsSnapshot } from '@shared/contracts'
import type { Edge, Node, NodeProps, XYPosition } from '@xyflow/react'

export type TFlowServiceNodeData = Record<string, unknown> & {
  service: TPublicService
  metrics?: TServiceMetricsSnapshot
  expanded: boolean
  pending: boolean
  incomingRelationIds: string[]
  outgoingRelationIds: string[]
  onToggleService: (service: TPublicService) => void
  onRestartService: (service: TPublicService) => void
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
}

export type TFlowServiceNode = Node<TFlowServiceNodeData, 'service'>

export type TFlowLaneNoteData = Record<string, unknown> & {
  title: string
  detail: string
}

export type TFlowLaneNoteNode = Node<TFlowLaneNoteData, 'lane-note'>
export type TFlowNode = TFlowServiceNode | TFlowLaneNoteNode
export type TFlowNodeProps = NodeProps<TFlowServiceNode>

export type TFlowEdgeData = Record<string, unknown> & {
  live: boolean
  laneOffset: number
}

export type TFlowEdge = Edge<TFlowEdgeData, 'relation'>

export type TFlowLayout = {
  positions: Record<string, XYPosition>
  laneNotePosition: XYPosition | null
}
