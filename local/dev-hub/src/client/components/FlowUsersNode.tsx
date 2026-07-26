import { Handle, Position, type NodeProps } from '@xyflow/react'
import { UserRound } from 'lucide-react'

import type { TFlowUsersNode } from './flow-spec'

const USER_COUNT = 4

export function FlowUsersNode({ data }: NodeProps<TFlowUsersNode>) {
  return (
    <div className='flow-users-node nodrag nopan nowheel' aria-label='Users accessing Groupher'>
      <div className='flow-users-group' aria-hidden='true'>
        {Array.from({ length: USER_COUNT }, (_, index) => (
          <span key={index} className='flow-user-avatar'>
            <UserRound />
          </span>
        ))}
      </div>
      <Handle
        id={data.outgoingRelationId}
        className='flow-service-handle is-source'
        type='source'
        position={Position.Bottom}
        isConnectable={false}
      />
    </div>
  )
}
