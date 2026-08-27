import type { Transition } from 'motion/react'

export const ROTATE_ANGLES = [6, 3, 2, 6, 12, 2, 3, 6, 12, 3, -2, 6] as const

export const CARD_LAYOUT_TRANSITION = {
  duration: 0.8,
  ease: [0.22, 1, 0.36, 1],
} as const

const CARD_STAGGER = 0.1

export const INCOMING_DOT_TRANSITION: Transition = {
  duration: 0.72,
  ease: 'linear',
  times: [0, 0.73, 1],
}

export const OUTGOING_TOP_DOT_TRANSITION: Transition = {
  duration: 2.3,
  ease: [0.22, 1, 0.36, 1],
  times: [0, 0.84, 1],
}

export const OUTGOING_BOTTOM_DOT_TRANSITION: Transition = {
  duration: 2.3,
  ease: [0.22, 1, 0.36, 1],
  delay: 0.56,
  times: [0, 0.84, 1],
}

export const listVariants = {
  visible: (direction: number) => ({
    transition: {
      delayChildren: direction > 0 ? 0.02 : 0,
      staggerChildren: CARD_STAGGER,
      staggerDirection: direction,
    },
  }),
}

export const cardVariants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: 28 * direction,
    scale: 0.92,
  }),
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: 36 * direction,
    scale: 0.9,
  }),
}
