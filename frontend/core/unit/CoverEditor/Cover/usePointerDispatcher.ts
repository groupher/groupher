import type { PointerEvent, RefObject } from 'react'

import type { TCoverPoint } from '../spec'
import type { TInteractionState, TInteractionUpdaters } from './interaction'

type TArgs = {
  finishInteraction: (event: PointerEvent<HTMLElement>) => void
  getCanvasPoint: (event: PointerEvent<HTMLElement>) => TCoverPoint | null
  interactionRef: RefObject<TInteractionState | null>
  onRadiusFinish: () => void
  updaters: TInteractionUpdaters
}

/**
 * Routes pointermove/up events using the discriminated interaction state. Events are ignored unless
 * the pointer id and capture owner match, preventing a second pointer or bubbled child event from
 * mutating the active draft. Geometry and final commit behavior remain delegated to their layers.
 */
const usePointerDispatcher = (args: TArgs) => {
  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const state = args.interactionRef.current
    if (!state || state.pointerId !== event.pointerId) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    event.preventDefault()
    if (state.type === 'cover-height') return args.updaters.updateCoverHeight(state, event)
    if (state.type === 'crop') return args.updaters.updateCrop(state, event)

    const point = args.getCanvasPoint(event)
    if (!point) return

    if (state.type === 'move') args.updaters.updateMove(state, point)
    else if (state.type === 'resize') args.updaters.updateResize(state, point)
    else if (state.type === 'radius') args.updaters.updateRadius(state, point)
    else if (state.type === 'magnifier-move') args.updaters.updateMagnifierMove(state, point)
    else if (state.type === 'magnifier-radius') args.updaters.updateMagnifierRadius(state, point)
    else args.updaters.updateMagnifierZoom(state, point)
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>): void => {
    const state = args.interactionRef.current
    if (!state || state.pointerId !== event.pointerId) return

    handlePointerMove(event)
    if (state.type === 'radius') args.onRadiusFinish()
    args.finishInteraction(event)
  }

  return { handlePointerMove, handlePointerUp }
}

export default usePointerDispatcher
