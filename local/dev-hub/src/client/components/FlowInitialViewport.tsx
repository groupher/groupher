import { useReactFlow, useStore } from '@xyflow/react'
import { useCallback, useLayoutEffect, useRef } from 'react'

import type { TFlowEdge, TFlowNode } from './flow-spec'

type TProps = {
  requestPathIds: string[]
  onReady: () => void
}

const INITIAL_ZOOM = 1
export const FLOW_INITIAL_TOP_INSET = 32

export function FlowInitialViewport({ requestPathIds, onReady }: TProps) {
  const initializedRef = useRef(false)
  const requestPathNodesInitialized = useStore(
    useCallback(
      (state) =>
        requestPathIds.every((id) => {
          const node = state.nodeLookup.get(id)
          return Boolean(node?.measured.width && node.measured.height)
        }),
      [requestPathIds],
    ),
  )
  const viewportWidth = useStore((state) => state.width)
  const { getNodesBounds, setViewport } = useReactFlow<TFlowNode, TFlowEdge>()

  useLayoutEffect(() => {
    if (!requestPathNodesInitialized || viewportWidth === 0 || initializedRef.current) return

    const bounds = getNodesBounds(requestPathIds)
    initializedRef.current = true

    void setViewport({
      x: viewportWidth / 2 - (bounds.x + bounds.width / 2) * INITIAL_ZOOM,
      y: FLOW_INITIAL_TOP_INSET - bounds.y * INITIAL_ZOOM,
      zoom: INITIAL_ZOOM,
    }).then(() => onReady())
  }, [
    getNodesBounds,
    onReady,
    requestPathIds,
    requestPathNodesInitialized,
    setViewport,
    viewportWidth,
  ])

  return null
}
