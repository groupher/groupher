import { Handle, Position } from '@xyflow/react'

import type { TFlowNodeProps } from './flow-spec'
import { ServiceCard } from './ServiceCard'

const getHandleOffset = (index: number, count: number): `${number}%` =>
  `${((index + 1) / (count + 1)) * 100}%`

export function FlowServiceNode({ data }: TFlowNodeProps) {
  return (
    <div className='flow-service-node nodrag nopan nowheel'>
      {data.incomingRelationIds.map((relationId, index) => (
        <Handle
          key={relationId}
          id={relationId}
          className='flow-service-handle'
          type='target'
          position={Position.Top}
          isConnectable={false}
          style={{ left: getHandleOffset(index, data.incomingRelationIds.length) }}
        />
      ))}
      <ServiceCard
        service={data.service}
        metrics={data.metrics}
        expanded={data.expanded}
        pending={data.pending}
        onToggleService={data.onToggleService}
        onRestartService={data.onRestartService}
        onToggleTerminal={data.onToggleTerminal}
        onOpenMetrics={data.onOpenMetrics}
      />
      {data.outgoingRelationIds.map((relationId, index) => (
        <Handle
          key={relationId}
          id={relationId}
          className='flow-service-handle'
          type='source'
          position={Position.Bottom}
          isConnectable={false}
          style={{ left: getHandleOffset(index, data.outgoingRelationIds.length) }}
        />
      ))}
    </div>
  )
}
