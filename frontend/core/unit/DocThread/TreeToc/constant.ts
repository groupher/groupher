export const TREE_TOC_LABEL = {
  nav: 'Docs tree table of contents',
  openTree: 'Open docs tree',
}

export const TREE_TOC_MODE = {
  DASH: 'dash',
  TREE: 'tree',
} as const

export const TREE_TOC_MOTION = {
  dash: {
    initial: { opacity: 0, x: -8 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 },
    transition: { duration: 0.14, ease: 'easeOut' },
  },
  tree: {
    initial: { opacity: 0, x: -6 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 },
    transition: { duration: 0.14, ease: 'easeOut' },
  },
} as const
