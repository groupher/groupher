import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'

import { getCoreRelationSpec } from '@/lib/core-flow-topology'

import type { TFlowEdge } from './flow-spec'

export const FLOW_EDGE_COLOR = {
  inactive: '#b8b8b3',
  active: '#4c9a67',
} as const

const LABEL_OFFSET_Y = 11
const EDGE_SAFE_LANE_GAP = 38

const midpoint = (start: number, end: number): number => start + (end - start) / 2

const edgePath = (points: Array<[number, number]>): string => {
  const [start, ...rest] = points
  return `M ${start[0]} ${start[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')}`
}

const getDirectPath = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  laneOffset: number,
): [string, number, number] => {
  if (Math.abs(sourceX - targetX) < 1 || Math.abs(sourceY - targetY) < 1) {
    return [
      edgePath([
        [sourceX, sourceY],
        [targetX, targetY],
      ]),
      midpoint(sourceX, targetX),
      midpoint(sourceY, targetY),
    ]
  }

  const turnY = midpoint(sourceY, targetY) + laneOffset
  return [
    edgePath([
      [sourceX, sourceY],
      [sourceX, turnY],
      [targetX, turnY],
      [targetX, targetY],
    ]),
    midpoint(sourceX, targetX),
    turnY,
  ]
}

const getOneTurnPath = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): [string, number, number] => {
  const preferredLaneY = sourceY + EDGE_SAFE_LANE_GAP
  const maxLaneY = targetY - EDGE_SAFE_LANE_GAP
  const laneY = maxLaneY >= preferredLaneY ? preferredLaneY : midpoint(sourceY, targetY)

  return [
    edgePath([
      [sourceX, sourceY],
      [sourceX, laneY],
      [targetX, laneY],
      [targetX, targetY],
    ]),
    midpoint(sourceX, targetX),
    laneY,
  ]
}

const getPathForEdge = (
  relationId: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  laneOffset: number,
): [string, number, number] => {
  if (getCoreRelationSpec(relationId)?.route === 'safe-lane') {
    return getOneTurnPath(sourceX, sourceY, targetX, targetY)
  }

  return getDirectPath(sourceX, sourceY, targetX, targetY, laneOffset)
}

export function FlowRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  label,
  data,
}: EdgeProps<TFlowEdge>) {
  const active = Boolean(data?.live)
  const relationId = data?.relationId || id
  const [path, labelX, labelY] = getPathForEdge(
    relationId,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data?.laneOffset || 0,
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={`flow-relation-edge ${active ? 'is-active' : ''}`}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className='flow-edge-label nodrag nopan'
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - LABEL_OFFSET_Y}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
