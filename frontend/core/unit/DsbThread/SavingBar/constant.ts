export const SAVING_BAR_TRANSITION = {
  duration: 0.18,
  ease: 'easeOut',
} as const

// The outer height animation owns document flow, so content below the bar follows
// the collapse instead of jumping when the bar unmounts.
export const SAVING_BAR_LAYOUT_TRANSITION = {
  duration: 0.22,
  ease: 'easeOut',
} as const

// The inner visual animation keeps the bar itself feeling light while the layout
// shell handles the space it occupies.
export const SAVING_BAR_ANIMATION = {
  initial: { opacity: 0, scale: 0.985, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.985, y: -4 },
} as const
