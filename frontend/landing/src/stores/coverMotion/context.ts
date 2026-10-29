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

export const useCoverMotionProgress = (): MotionValue<number> => useCoverMotion().progress
export const useCoverMotionTarget = () => useCoverMotion().registerCover
export const useCoverMotionActivation = () => useCoverMotion().activateCover
