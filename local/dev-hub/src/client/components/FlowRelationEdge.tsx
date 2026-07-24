import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

import type { TFlowEdge } from './flow-spec'

export const FLOW_EDGE_COLOR = {
  inactive: '#b8b8b3',
  active: '#4c9a67',
} as const

export function FlowRelationEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  label,
  data,
}: EdgeProps<TFlowEdge>) {
  const active = Boolean(data?.live)
  const centerY = (sourceY + targetY) / 2 + (data?.laneOffset || 0)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
    centerY,
    offset: 24,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={`flow-relation-edge ${active ? 'is-active' : ''}`}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className='flow-edge-label nodrag nopan'
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 11}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
