import { useStore } from '@xyflow/react'
import { useCallback, useLayoutEffect } from 'react'

import { FLOW_INITIAL_TOP_INSET } from './FlowInitialViewport'

type TProps = {
  requestPathIds: string[]
  onHeightChange: (height: number) => void
}

const FLOW_BOTTOM_INSET = 96

export function FlowCanvasSizer({ requestPathIds, onHeightChange }: TProps) {
  const requestPathHeight = useStore(
    useCallback(
      (state) => {
        let top = Number.POSITIVE_INFINITY
        let bottom = Number.NEGATIVE_INFINITY

        for (const id of requestPathIds) {
          const node = state.nodeLookup.get(id)
          const height = node?.measured.height
          if (!node || !height) return 0

          const y = node.internals.positionAbsolute.y
          top = Math.min(top, y)
          bottom = Math.max(bottom, y + height)
        }

        return Number.isFinite(top) ? Math.ceil(bottom - top) : 0
      },
      [requestPathIds],
    ),
  )

  useLayoutEffect(() => {
    if (requestPathHeight === 0) return
    onHeightChange(FLOW_INITIAL_TOP_INSET + requestPathHeight + FLOW_BOTTOM_INSET)
  }, [onHeightChange, requestPathHeight])

  return null
}
