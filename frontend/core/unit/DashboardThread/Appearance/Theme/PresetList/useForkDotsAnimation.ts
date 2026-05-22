import { useAnimationControls } from 'motion/react'
import { useEffect } from 'react'

import {
  CARD_LAYOUT_TRANSITION,
  INCOMING_DOT_TRANSITION,
  OUTGOING_BOTTOM_DOT_TRANSITION,
  OUTGOING_TOP_DOT_TRANSITION,
} from './constant'

export default function useForkDotsAnimation(showForkRelation: boolean) {
  const incomingDotControls = useAnimationControls()
  const outgoingTopDotControls = useAnimationControls()
  const outgoingBottomDotControls = useAnimationControls()

  useEffect(() => {
    if (!showForkRelation) return

    let live = true
    let animationTimer: ReturnType<typeof setTimeout> | null = null

    const playForkDots = () => {
      incomingDotControls.set({ x: 64, y: 0, opacity: 0, scale: 1 })
      outgoingTopDotControls.set({ x: -2, y: -4, opacity: 0, scale: 0.95 })
      outgoingBottomDotControls.set({ x: -2, y: 4, opacity: 0, scale: 0.95 })

      void incomingDotControls
        .start({
          x: [64, 2, 2],
          y: [0, 0, 0],
          opacity: [0.9, 0.85, 0],
          scale: [1, 0.3, 0],
          transition: INCOMING_DOT_TRANSITION,
        })
        .then(() => {
          if (!live) return

          void outgoingTopDotControls.start({
            x: [-2, -46, -46],
            y: [-4, -4, -4],
            opacity: [0.85, 0, 0],
            scale: [0.35, 1, 1],
            transition: OUTGOING_TOP_DOT_TRANSITION,
          })
          void outgoingBottomDotControls.start({
            x: [-2, -48, -48],
            y: [4, 4, 4],
            opacity: [0.85, 0, 0],
            scale: [0.35, 1, 1],
            transition: OUTGOING_BOTTOM_DOT_TRANSITION,
          })
        })
    }

    animationTimer = setTimeout(() => {
      playForkDots()
    }, CARD_LAYOUT_TRANSITION.duration * 1000)

    return () => {
      live = false
      if (animationTimer) clearTimeout(animationTimer)
      incomingDotControls.stop()
      outgoingTopDotControls.stop()
      outgoingBottomDotControls.stop()
    }
  }, [incomingDotControls, outgoingBottomDotControls, outgoingTopDotControls, showForkRelation])

  return {
    incomingDotControls,
    outgoingTopDotControls,
    outgoingBottomDotControls,
  }
}
