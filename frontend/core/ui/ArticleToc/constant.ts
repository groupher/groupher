export const ARTICLE_TOC_LABEL = {
  nav: 'Article table of contents',
  pin: 'Pin table of contents',
  unpin: 'Unpin table of contents',
}

export const ARTICLE_TOC_MODE = {
  DASH: 'dash',
  HEADERS: 'headers',
}

export const ARTICLE_TOC_MOTION = {
  dash: {
    initial: { opacity: 0, x: 8 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, transition: { duration: 0 } },
    transition: { duration: 0.14, ease: 'easeOut' },
  },
  headers: {
    initial: { opacity: 0, x: 6 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8 },
    transition: { duration: 0.14, ease: 'easeOut' },
  },
} as const
