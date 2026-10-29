import type { MotionValue } from 'motion/react'
import { createContext, use } from 'react'

type TCoverMotionContext = {
  progress: MotionValue<number>
  registerCover: (element: HTMLDivElement | null) => void
  activateCover: () => void
}

export const CoverMotionContext = createContext<TCoverMotionContext | null>(null)

const useCoverMotion = (): TCoverMotionContext => {
  const context = use(CoverMotionContext)
  if (!context) throw new Error('Cover motion must be used within Main')
  return context
}

/** Shares the opening cover's scroll progress with its animated descendants. */
export const useCoverMotionProgress = (): MotionValue<number> => useCoverMotion().progress

/** Registers the cover element used as the scroll animation target. */
export const useCoverMotionTarget = () => useCoverMotion().registerCover

/** Starts the cover animation after its scene is ready. */
export const useCoverMotionActivation = () => useCoverMotion().activateCover
