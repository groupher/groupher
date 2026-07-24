import { Panel, useReactFlow } from '@xyflow/react'

import type { TFlowEdge, TFlowNode } from './flow-spec'

type TProps = {
  requestPathIds: string[]
  standaloneIds: string[]
}

export function FlowNavigator({ requestPathIds, standaloneIds }: TProps) {
  const { fitView } = useReactFlow<TFlowNode, TFlowEdge>()

  const focusNodes = (ids: string[]) => {
    void fitView({
      nodes: ids.map((id) => ({ id })),
      padding: 0.16,
      maxZoom: 0.95,
      duration: 320,
    })
  }

  return (
    <Panel className='flow-navigator' position='top-right'>
      <button type='button' onClick={() => focusNodes(requestPathIds)}>
        Request path
      </button>
      {standaloneIds.length > 0 ? (
        <button type='button' onClick={() => focusNodes(standaloneIds)}>
          Standalone
          <span>{standaloneIds.length}</span>
        </button>
      ) : null}
    </Panel>
  )
}
