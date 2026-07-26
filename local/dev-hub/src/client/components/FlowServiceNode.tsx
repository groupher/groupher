import { Handle, Position } from '@xyflow/react'

import type { TFlowHandleSide, TRelationHandleSpec } from '@/lib/core-flow-topology'
import { getCoreRelationSpec } from '@/lib/core-flow-topology'

import type { TFlowNodeProps } from './flow-spec'
import { ServiceCard } from './ServiceCard'

const getHandleOffset = (index: number, count: number): `${number}%` =>
  `${((index + 1) / (count + 1)) * 100}%`

type THandleConfig = {
  position: Position
  style: { left?: string; right?: string; top?: string }
}

const POSITION_BY_HANDLE_SIDE: Record<TFlowHandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

const toHandleConfig = (spec?: TRelationHandleSpec): THandleConfig | null => {
  if (!spec) return null

  return {
    position: POSITION_BY_HANDLE_SIDE[spec.side],
    style: spec.style || {},
  }
}

const getHandlePosition = (relationId: string, type: 'source' | 'target'): THandleConfig => {
  const configured = toHandleConfig(getCoreRelationSpec(relationId)?.[type])
  if (configured) return configured

  return {
    position: type === 'source' ? Position.Bottom : Position.Top,
    style: {},
  }
}

const renderRelationHandle = (
  relationId: string,
  index: number,
  count: number,
  type: 'source' | 'target',
) => {
  const handle = getHandlePosition(relationId, type)

  return (
    <Handle
      key={relationId}
      id={relationId}
      className={`flow-service-handle is-${type}`}
      type={type}
      position={handle.position}
      isConnectable={false}
      style={{
        ...handle.style,
        ...(handle.position === Position.Top &&
          !handle.style.left && {
            left: getHandleOffset(index, count),
          }),
        ...(handle.position === Position.Bottom &&
          !handle.style.left && {
            left: getHandleOffset(index, count),
          }),
      }}
    />
  )
}

export function FlowServiceNode({ data }: TFlowNodeProps) {
  return (
    <div className='flow-service-node nodrag nopan nowheel'>
      {data.incomingRelationIds.map((relationId, index) =>
        renderRelationHandle(relationId, index, data.incomingRelationIds.length, 'target'),
      )}
      <ServiceCard
        service={data.service}
        metrics={data.metrics}
        expanded={data.expanded}
        compact={data.compact}
        pending={data.pending}
        onToggleService={data.onToggleService}
        onStartService={data.onStartService}
        onRestartService={data.onRestartService}
        onToggleTerminal={data.onToggleTerminal}
        onOpenMetrics={data.onOpenMetrics}
        onOpenConfig={data.onOpenConfig}
        onOpenDependencies={data.onOpenDependencies}
      />
      {data.outgoingRelationIds.map((relationId, index) =>
        renderRelationHandle(relationId, index, data.outgoingRelationIds.length, 'source'),
      )}
    </div>
  )
}
