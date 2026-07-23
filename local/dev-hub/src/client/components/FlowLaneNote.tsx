import type { NodeProps } from '@xyflow/react'

import type { TFlowLaneNoteNode } from './flow-spec'

export function FlowLaneNote({ data }: NodeProps<TFlowLaneNoteNode>) {
  return (
    <div className='flow-lane-note'>
      <span>{data.title}</span>
      <small>{data.detail}</small>
    </div>
  )
}
