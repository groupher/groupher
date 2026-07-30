import { Panel, useReactFlow } from '@xyflow/react'
import { Maximize2, Minus, Plus } from 'lucide-react'

import type { TFlowEdge, TFlowNode } from './flow-spec'

type TProps = {
  requestPathIds: string[]
}

export function FlowNavigator({ requestPathIds }: TProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow<TFlowNode, TFlowEdge>()

  const focusNodes = (ids: string[]) => {
    void fitView({
      nodes: ids.map((id) => ({ id })),
      padding: 0.16,
      maxZoom: 0.95,
      duration: 320,
    })
  }

  return (
    <Panel className='flow-toolbar' position='top-right'>
      <div className='flow-zoom-controls' aria-label='Flow zoom controls'>
        <button
          type='button'
          aria-label='Zoom in'
          title='Zoom in'
          onClick={() => zoomIn({ duration: 180 })}
        >
          <Plus aria-hidden='true' />
        </button>
        <button
          type='button'
          aria-label='Zoom out'
          title='Zoom out'
          onClick={() => zoomOut({ duration: 180 })}
        >
          <Minus aria-hidden='true' />
        </button>
        <button
          type='button'
          aria-label='Fit view'
          title='Fit view'
          onClick={() => focusNodes(requestPathIds)}
        >
          <Maximize2 aria-hidden='true' />
        </button>
      </div>
    </Panel>
  )
}
