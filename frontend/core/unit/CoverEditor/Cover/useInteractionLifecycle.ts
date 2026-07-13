import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'

import type { TInteractionMode, TInteractionState } from './interaction'

type TArgs = {
  commitCoverHeight: (height: number) => void
  flushImageDraft: () => void
  initialCoverHeight: number
}

/**
 * Owns the state that must be shared by every pointer interaction: the active interaction
 * description, its visual mode, the transient cover-height preview, and the single finish path.
 * Start handlers may write the ref/mode, but they must never commit or flush independently.
 */
const useInteractionLifecycle = ({
  commitCoverHeight,
  flushImageDraft,
  initialCoverHeight,
}: TArgs) => {
  const interactionRef = useRef<TInteractionState | null>(null)
  const coverHeightPreviewRef = useRef(initialCoverHeight)
  const [interactionMode, setInteractionMode] = useState<TInteractionMode>('idle')

  /**
   * Pointer capture is acquired by each concrete handle, but every interaction must finish
   * through this path so preview state cannot outlive the pointer that created it.
   */
  const finishInteraction = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    interactionRef.current = null
    // Height is previewed directly on the canvas while dragging and committed only once here.
    if (state?.type === 'cover-height') {
      commitCoverHeight(coverHeightPreviewRef.current)
    }
    setInteractionMode('idle')
    // Draft patches are scheduled during pointermove; flushing here produces one final commit.
    flushImageDraft()
  }

  return {
    coverHeightPreviewRef,
    finishInteraction,
    interactionMode,
    interactionRef,
    setInteractionMode,
  }
}

export default useInteractionLifecycle
